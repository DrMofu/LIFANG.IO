<!-- tutorial-widget:cube-playground -->


To make cube moves easy to communicate and record, we use a set of letters as notation. Select a move in the interactive panel above to see its animation.

## The Six Faces

A cube has six faces, each represented by a letter:

| Letter | Name | Position |
| --- | --- | --- |
| `R` | Right | The face on your right |
| `L` | Left | The face on your left |
| `U` | Up | The top face |
| `D` | Down | The bottom face |
| `F` | Front | The face pointing toward you |
| `B` | Back | The face pointing away from you |

> These letters describe each face relative to the person holding the cube, not a fixed color.

By convention, many tutorials place yellow on top (`U`) and white on the bottom (`D`). This site defaults to green in front (`F`) and orange on the right (`R`). Some tutorials use blue in front and red on the right instead. You can choose another color scheme in [Settings](/settings).

<!-- tutorial-widget:notation-gallery {"group":"faces"} -->


The same notation works with every color scheme. As long as you keep the same grip, `R` always means the face on your right.


## Face Turns

The face letters also describe turns.

<!-- tutorial-widget:notation-gallery {"group":"turns"} -->

A capital letter by itself means to turn that face 90° clockwise. Add a prime mark `'` for a 90° counterclockwise turn, or add `2` for a 180° turn:

| Notation | Meaning |
| --- | --- |
| `R` | Turn the right face 90° clockwise |
| `R'` | Turn the right face 90° counterclockwise |
| `R2` | Turn the right face 180°; clockwise and counterclockwise give the same result |


<!-- tutorial-widget:notation-gallery {"group":"suffixes"} -->

The same rule applies to `L`, `U`, `D`, `F`, and `B`. For example:

- `U`: turn the upper face 90° clockwise.
- `F'`: turn the front face 90° counterclockwise.
- `D2`: turn the bottom face 180°.


A lowercase face letter describes a wide turn: the outer face and the adjacent inner slice turn together. For example:

- `u`: turn the upper two layers together.
- `f'`: turn the front two layers together counterclockwise.
- `d2`: turn the bottom two layers together by 180°.

<!-- tutorial-widget:notation-gallery {"group":"wide"} -->


## Slice Moves: M, E, and S

`M`, `E`, and `S` turn an inner slice without turning either outer face. Their directions are defined by reference to an outer face:

| Notation | Slice | Direction |
| --- | --- | --- |
| `M` | Between `L` and `R` | Same direction as `L` |
| `E` | Between `U` and `D` | Same direction as `D` |
| `S` | Between `F` and `B` | Same direction as `F` |


<!-- tutorial-widget:notation-gallery {"group":"slices"} -->

`M'` turns the middle slice in the direction opposite to `L`, while `M2` turns it by 180°.

## Algorithms

Spaces make an algorithm easier to read by separating its moves. Parentheses `(` and `)` can group moves when needed.

For example, `(R U R' U') (R' F R F')` contains two groups. The first is `R U R' U'`, a common sequence often called the Sexy Move, and the second is `R' F R F'`.

If a sequence is repeated, `(R U R' U') (R U R' U') (R U R' U')` can be shortened to `(R U R' U')3`. The final `3` means to repeat the group three times.


## Whole-Cube Rotations: x, y, and z


Lowercase `x`, `y`, and `z` rotate the entire cube instead of a single layer. Think of them as rotations around three spatial axes:

| Notation | Axis | Direction |
| --- | --- | --- |
| `x` | Left–right axis | Same direction as `R` |
| `y` | Up–down axis | Same direction as `U` |
| `z` | Front–back axis | Same direction as `F` |

They can also use `'` and `2`:

- `x'`: rotate the whole cube 90° around the left–right axis in the reverse direction.
- `y2`: rotate the whole cube 180° around the up–down axis.
- `z`: rotate the whole cube 90° around the front–back axis in the same direction as `F`.

> After a whole-cube rotation, subsequent `R`, `U`, and other face moves are interpreted from the cube's new orientation.

<!-- tutorial-widget:notation-gallery {"group":"rotations"} -->
