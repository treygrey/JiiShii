# Sprite Cookbook

This is the setup guide for layered sprites. It is about configuring character
art once so scenes can stay simple.

Scenes should ask for state:

```js
show("alex", { outfit: "casual", expression: "happy" })
show("alex", { body: "guarded" })
```

Sprite recipes decide which image layers make that state visible.

## Folder Layout

Put sprite art under `src/game/assets/sprites/<character-id>/`.

```text
src/game/assets/sprites/
  _default.recipe.js
  alex/
    bodies/
      default.png
      guarded.png
    outfits/
      casual.png
      hoodie.png
    emotions/
      neutral.png
      happy.png
      embarrassed.png
    overlays/
      tattoo.png
      bandage.png
    foreground/
      hair.png
    sprite.recipe.js
```

Run this after adding, renaming, or moving sprite files:

```powershell
npm.cmd run gen:sprites
```

The generated `src/game/sprite-manifest.json` is the runtime index. Do not edit
it by hand.

## Default Recipe

The global recipe lives at `src/game/assets/sprites/_default.recipe.js`.

```js
export default [
  { id: "body", source: "bodies", key: "$body", required: true },
  { id: "outfit", source: "outfits", key: "$outfit", required: true },
  { id: "expression", source: "emotions", key: "$expression", required: false },
  { id: "foregroundHair", source: "foreground", key: "hair", required: false }
];
```

That means a scene request like this:

```js
show("alex", {
  outfit: "hoodie",
  expression: "happy",
  body: "guarded"
})
```

tries to build these layers, bottom to top:

```text
alex/bodies/guarded.png
alex/outfits/hoodie.png
alex/emotions/happy.png
alex/foreground/hair.png
```

`body` is sticky like `outfit` and `expression`. If a later `show()` only changes
the expression, the previous body stays active.

## Character Recipes

Add `sprite.recipe.js` inside a character folder when that character needs
custom construction. A character recipe replaces the default recipe unless it
imports and spreads it.

```js
import defaultRecipe from "../_default.recipe.js";

export default [
  ...defaultRecipe,
  {
    id: "bandage",
    source: "overlays",
    key: "bandage",
    whenFlag: "$characterId_bandaged",
    required: false
  }
];
```

For `alex`, `$characterId_bandaged` becomes `alex_bandaged`.

## Recipe Fields

Each recipe entry describes one possible image layer.

```js
{
  id: "tattoo",
  source: "overlays",
  key: "tattoo",
  whenFlag: "$characterId_tattoo",
  unlessOutfit: "hoodie",
  required: false
}
```

Fields:

- `id`: stable layer name used by the renderer and debug output.
- `source`: folder inside the character sprite folder.
- `key`: filename without extension, or a token.
- `required`: warns during validation when the layer is missing.
- `whenFlag`: only renders when the variable/flag is on.
- `onlyOutfit`: only renders for one outfit or a list of outfits.
- `unlessOutfit`: skips for one outfit or a list of outfits.

Tokens:

- `$characterId`
- `$outfit`
- `$expression`
- `$body`

## Common Patterns

Tattoo visible except under covering clothes:

```js
{
  id: "torsoTattoo",
  source: "overlays",
  key: "torso_tattoo",
  whenFlag: "$characterId_tattoo",
  unlessOutfit: ["hoodie", "winter_coat"]
}
```

Injury appears only after a story flag:

```js
{
  id: "cheekBandage",
  source: "overlays",
  key: "cheek_bandage",
  whenFlag: "$characterId_cheek_bandage"
}
```

Outfit-specific prop:

```js
{
  id: "apronBow",
  source: "overlays",
  key: "apron_bow",
  onlyOutfit: "maid_uniform"
}
```

Custom body pose:

```js
show("alex", {
  outfit: "hoodie",
  expression: "embarrassed",
  body: "guarded"
})
```

Then provide:

```text
src/game/assets/sprites/alex/bodies/guarded.png
```

## Sprite Transitions

Scene commands can request transition presets:

```js
show("alex", {
  outfit: "casual",
  expression: "happy",
  transition: "dissolve"
})

move("alex", { at: "right", transition: "move" })
hide("alex", { transition: "moveOutRight" })
```

Built-in staging transitions:

- `cut`: instant.
- `dissolve`: default soft opacity transition.
- `fade`: slightly slower opacity transition.
- `move`: smooth movement between positions.
- `ease`: slower movement with a softer cubic easing.
- `moveInLeft` / `moveInRight`: enter from offscreen.
- `moveOutLeft` / `moveOutRight`: exit toward offscreen.

Built-in full-figure replacement transitions:

- `replaceCut`: decode the new figure, remove the old one, show the new one.
- `replaceDip`: fade the old figure out, then fade the new figure in.
- `replaceFlip`: collapse the old figure to zero width, swap, then open the new one.

Use replacement transitions when the rendered figure changes as a full layer
swap, such as an outfit or body change. These modes avoid haloing by not
crossfading two full silhouettes over each other.

```js
show("alex", {
  outfit: "dress",
  transition: "replaceDip"
})

show("alex", {
  outfit: "maid",
  transition: "replaceFlip",
  duration: 320
})
```

Expression-only changes on the same outfit/body swap the face layer in place.
That keeps quick expression changes clean and avoids doubled sprite edges.

## Custom Sprite Transitions

Register game-specific transitions in `src/game/sprite-animations.js`. The app
loads that file before scene validation, so registered names can be used in
scene scripts without editing engine files.

```js
import { registerIrlSpriteTransition } from "./vn.js";

registerIrlSpriteTransition("quickDip", {
  duration: 120,
  easing: "ease-out",
  replacement: "dip"
});
```

Transition descriptors are intentionally declarative so skip, rollback, and
load replay stay predictable.

Supported fields:

- `duration`: milliseconds.
- `easing`: CSS easing string.
- `enterFrom`: position preset for show/enter movement.
- `exitTo`: position preset for hide/exit movement.
- `replacement`: `cut`, `dip`, or `flip` for full figure replacements.

## Compatibility Layout

Older top-level files still work:

```text
alex/alex_head.png
alex/foreground_hair.png
alex/outfits/hoodie.png
alex/emotions/happy.png
```

The manifest maps:

- top-level `*head*.png` to `bodies/default`
- top-level `*foreground*.png` to `foreground/hair`

Use the folder layout for new work. It is clearer and easier to extend.

## Troubleshooting

Missing body warning:

```text
recipe layer "body" needs bodies/guarded.png
```

Add the file or stop requesting that body.

Missing outfit warning:

```text
show("alex", { outfit: "hoodie" }) - "alex" has no such outfit.
```

Check the filename under `outfits/`, then run `npm.cmd run gen:sprites`.

Overlay does not appear:

- Confirm the overlay file exists in `overlays/`.
- Confirm the flag name after token substitution.
- Check `onlyOutfit` and `unlessOutfit`.
- Run `npm.cmd run gen:sprites`.

Expression resolves to an alias:

The engine has a few built-in expression aliases. For example, `happy` can fall
back to names like `smile`, `content_smile`, or `laughing` when direct
`happy.png` art does not exist.

## Rule Of Thumb

Scenes describe the character state. Recipes describe the image stack. If a
scene is manually thinking about tattoos, hair foregrounds, injury overlays, or
which layer goes above clothes, move that logic into a sprite recipe.
