欢迎来到层先法教学！

层先法先复原魔方底层，再复原中间层，最后复原顶层。因为一层层复原，故名层先法。

本方法虽然步骤繁琐，但是公式量最少，最适合新手入门。

如果读者还不熟悉转动符号，请先看[认识魔方公式](/articles/认识魔方公式)。

你可以在此调整本网站中魔方颜色和颜色朝向。推荐把黄色设置为顶面颜色。

<!-- tutorial-widget:orientation-settings -->

## 复原流程

<!-- tutorial-widget:solve-flow -->

## 第一步：底层小花

本步目标：把四个底色`face:D`棱块移动到顶部。

<!-- tutorial-widget:cube-stage {"title":"底层小花","items":[{"title":"本阶段目标","content":"四张底面贴纸朝上","facelets":"XDXDUDXDXXXXXXXXXXXXXXXXXXXXXXXDXXXXXXXXLXXXXXXXXBXXXX"}]} -->

找到一个带底面`face:D`的棱块，旋转魔方，将其放到我们右手侧，然后按它所在的位置处理，最终使得`face:D`面冲上：

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35}],"transitions":["R'","F'"],"content":"情况一：顶层棱块，底面贴纸朝右"} -->

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35}],"transitions":["F'"],"content":"情况二：中层棱块，底面贴纸朝右"} -->

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXXXXXXXXXXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35}],"transitions":["R"],"content":"情况三：中层棱块，底面贴纸朝前"} -->

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXXXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35}],"transitions":["R","F'"],"content":"情况四：底层棱块，底面贴纸朝右"} -->

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXXXXXXXXXXXXXXXXXXXXXXXXXXDXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":-28,"cameraLongitude":35},{"facelets":"XXXXUXXXXXXXXXXXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35}],"transitions":["R","R"],"content":"情况五：底层棱块，底面贴纸朝下"} -->

上述五种情况无需死记硬背，理解后可以自由灵活运用。

如果准备转入的顶层位置已经有底色`face:D`贴纸朝上，先转动顶层 `U`，把这片花瓣移开，让目标位置空出来，再把当前的底色块转上去，避免破坏已经拼好的花瓣。

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXDXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXDUXXXXXXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXDUXXDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35}],"transitions":["U","F'"],"content":"先转 U，把已有花瓣移开；再转 F'，将新的底色贴纸送上顶面。"} -->

## 第二步：底层十字

<!-- tutorial-widget:cube-stage {"title":"底层十字","items":[{"title":"本阶段目标","content":"底面组成十字，四颗底棱的侧面贴纸与各自中心同色。","facelets":"XXXXUXXXXXXXXRXXRXXXXXFXXFXXDXDDDXDXXXXXLXXLXXXXXBXXBX","cameraLatitude":-28}]} -->

把小花的四颗棱块逐一转动到底层，同时确定对齐各自的侧面。

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUDXXXXFXXXXXXXXXXXFXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXDXXXXXXXXXXXFXXFXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXXXXXXXXXXXXXXXXFXXFXXDXXDXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":-28,"cameraLongitude":35}],"transitions":["U","F2"]} -->

<!-- tutorial-widget:cube-sequence {"cubes":[{"facelets":"XXXXUXXDXXXXXRXXXXXRXXXXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUDXXXXRXXRXXXXXXXXXXXXXXXXXDXXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":25,"cameraLongitude":35},{"facelets":"XXXXUXXXXXXXXRXXRXXXXXXXXXXXXXXDDXXXXXXXXXXXXXXXXXXXXX","cameraLatitude":-28,"cameraLongitude":35}],"transitions":["U'","R2"]} -->

1. 转动 `U`，让一片花瓣的侧面贴纸与下面的中心块同色。
2. 将这个侧面转 `180°`。将`face:D`贴纸移动到底部。
3. 对剩余花瓣重复此步骤。


## 第三步：复原底层

底面继续朝下。这一步补齐四个底角。

1. 在顶层找一颗带底面贴纸的角块，读出它另外两张贴纸。
2. 找到这两个侧面中心之间的底层角槽，水平转动整颗魔方，把角槽放在右前下方。
3. 转动 `U`，把目标角块放到角槽正上方，也就是右前上方。
4. 重复下面四步，直到这个底角的三张贴纸分别与三个中心同色。

<!-- tutorial-widget:algorithm-player {"title":"底角插入","algorithm":"R U R' U'","note":"目标角块在右前上方，目标槽在右前下方。每次做完四步再检查；未归位就继续做同一组。"} -->

底面贴纸可能朝右、朝前或朝上，三种情况都用同一条公式。中间不要加 `U`，也不要转整颗魔方。

<!-- tutorial-widget:cube-stage {"title":"右前上角的三种朝向","items":[{"title":"底面贴纸朝右","content":"角块放在目标槽正上方，重复插角公式。","facelets":"XXXXUXXXRDXXXRXXRXXXFXFXXFXXDXDDDXDXXXXXLXXLXXXXXBXXBX"},{"title":"底面贴纸朝前","content":"做完整组后再检查，不在公式中途加转动。","facelets":"XXXXUXXXFRXXXRXXRXXXDXFXXFXXDXDDDXDXXXXXLXXLXXXXXBXXBX"},{"title":"底面贴纸朝上","content":"仍用同一条插角公式，直到目标底角三面归位。","facelets":"XXXXUXXXDFXXXRXXRXXXRXFXXFXXDXDDDXDXXXXXLXXLXXXXXBXXBX"}]} -->

若目标角块已经在底层，但位置或朝向不对，把它放在右前下方，做一次插角公式将它送到顶层，再重新摆位。

四个底角全部归位后，底面完整，四个侧面的最下排也分别与中心同色。

<!-- tutorial-widget:cube-stage {"title":"底层","items":[{"title":"底层完成","content":"底面完整，四个侧面的最下排与各自中心同色。","facelets":"XXXXUXXXXXXXXRXRRRXXXXFXFFFDDDDDDDDDXXXXLXLLLXXXXBXBBB","cameraLatitude":-28}]} -->

## 第四步：复原中间层

在顶层找一颗**不含顶面贴纸**的棱块。转动 `U`，让它朝向自己的贴纸与前面中心同色，再看朝上的那张贴纸属于哪一面。

<!-- tutorial-widget:cube-stage {"title":"中层棱块的目标槽","items":[{"title":"插入右前槽","content":"前上棱的朝前贴纸对齐前面中心，朝上贴纸与右面中心同色。","facelets":"XXXXUXXRXXXXXRXRRRXFXXFXFFFDDDDDDDDDXXXXLXLLLXXXXBXBBB"},{"title":"插入左前槽","content":"前上棱的朝前贴纸对齐前面中心，朝上贴纸与左面中心同色。","facelets":"XXXXUXXLXXXXXRXRRRXFXXFXFFFDDDDDDDDDXXXXLXLLLXXXXBXBBB"}]} -->

属于右面中心，插入右前槽：

<!-- tutorial-widget:algorithm-player {"title":"中棱向右插入","algorithm":"U R U' R' U' F' U F","note":"棱块在前上方，朝前的贴纸已对齐前面中心，朝上的贴纸与右面中心同色。"} -->

属于左面中心，插入左前槽：

<!-- tutorial-widget:algorithm-player {"title":"中棱向左插入","algorithm":"U' L' U L U F U' F'","note":"棱块在前上方，朝前的贴纸已对齐前面中心，朝上的贴纸与左面中心同色。"} -->

如果顶层找不到目标棱，而中层还有错块，把错误槽放到右前方，做一次右插公式。错块会回到顶层，再按上面的办法插入。

完成后，底面完整，四个侧面的下两排都与各自中心同色。

<!-- tutorial-widget:cube-stage {"title":"前两层","items":[{"title":"前两层完成","content":"底层保留完整，四个侧面的下两排已复原。","facelets":"XXXXUXXXXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB"}]} -->

## 第五步：顶层十字

只看四颗顶棱的顶面贴纸，不看角块。已经是十字就跳到第六步；否则按下图摆好顶层。

<!-- tutorial-widget:cube-stage {"title":"顶层十字的三种待处理形状","items":[{"title":"中心点","content":"四颗顶棱都没有顶面贴纸朝上，先做一次公式。","facelets":"XXXXUXXXXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB"},{"title":"折角","content":"从上方看，两张顶面贴纸放在后、左。","facelets":"XUXUUXXXXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB"},{"title":"一字","content":"两张顶面贴纸放在左、右，横着摆。","facelets":"XXXUUUXXXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB"}]} -->

- **一字：** 两张顶面贴纸放在左、右，横着摆。
- **折角：** 两张顶面贴纸放在后、左，从上方看是 `┌`。
- **中心点：** 四颗顶棱都没有顶面贴纸朝上，先从任意方向做一次。

<!-- tutorial-widget:algorithm-player {"title":"顶层十字","algorithm":"F R U R' U' F'","note":"一字横放，折角放在后、左。做完一次，重新看形状并摆位，再决定是否继续。"} -->

四张顶面贴纸全部朝上，十字就完成了。这一步不要求棱块的侧面贴纸对齐中心。

<!-- tutorial-widget:cube-stage {"title":"顶层十字","items":[{"title":"顶层十字完成","content":"四张顶面贴纸朝上，棱块的侧面贴纸可以暂时不对齐。","facelets":"XUXUUUXUXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB"}]} -->

## 第六步：顶层棱块归位

转动 `U`，找出最多能同时对齐中心的顶棱。四颗都对齐就跳到第七步；未完成时，总能找到两颗对齐。

<!-- tutorial-widget:cube-stage {"title":"顶棱侧面的两种对齐情况","items":[{"title":"相邻两颗对齐","content":"图中前、右已对齐。水平转动整颗魔方，把它们移到后、右再做公式。","facelets":"XUXUUUXUXXRXRRRRRRXFXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB"},{"title":"相对两颗对齐","content":"先做一次公式，再转 U 找到相邻的一对。","facelets":"XUXUUUXUXXXXRRRRRRXFXFFFFFFDDDDDDDDDXXXLLLLLLXBXBBBBBB"}]} -->

- **两颗相邻：** 水平转动整颗魔方，把已对齐的两颗放在后面和右面，做下面的公式。
- **两颗相对：** 先从任意正面做一次公式，再转 `U` 检查。此时可找到相邻的一对，按上一种情况重新摆位。

<!-- tutorial-widget:algorithm-player {"title":"顶棱换位","algorithm":"R U R' U R U2 R'","setupAlgorithm":"U' R U2 R' U' R U' R'","note":"后、右两颗顶棱已对齐中心。公式做完后还要转动 U，使四颗顶棱与中心对齐；演示停在这次对齐之前。"} -->

每做完一次，先试 `U`、`U'` 或 `U2` 对齐，再判断是否需要重做。顶角的变化留到下一步处理。

<!-- tutorial-widget:cube-stage {"title":"顶层棱块归位","items":[{"title":"四颗顶棱归位","content":"顶层保留十字，四颗顶棱的侧面贴纸与中心同色。","facelets":"XUXUUUXUXXRXRRRRRRXFXFFFFFFDDDDDDDDDXLXLLLLLLXBXBBBBBB"}]} -->

## 第七步：顶层角块归位

看角块的三张贴纸是否与周围三个中心同色，先不要求顶面贴纸朝上。

<!-- tutorial-widget:cube-stage {"title":"顶角的位置与朝向","items":[{"title":"位置正确，朝向未正","content":"右前上角的三张贴纸与周围三个中心同色，只需要翻正。","facelets":"XUXUUUXUFURXRRRRRRXFRFFFFFFDDDDDDDDDXLXLLLLLLXBXBBBBBB"},{"title":"朝上也可能放错位置","content":"这颗角块属于后、右两个中心之间，不能留在右前角。","facelets":"XUXUUUXUUBRXRRRRRRXFRFFFFFFDDDDDDDDDXLXLLLLLLXBXBBBBBB"}]} -->

找到一颗位置正确的顶角，水平转动整颗魔方，把它放在右前上方。做下面的公式，让其余三颗顶角循环换位。

<!-- tutorial-widget:algorithm-player {"title":"顶角换位","algorithm":"U R U' L' U R' U' L","note":"位置正确的顶角放在右前上方；它会留在原位，其余三颗顶角换位，四颗顶棱不变。"} -->

做完后重新检查。若仍只有右前上角的位置正确，保持握法再做一次。若一开始没有任何正确角，从任意正面做一次，再找正确角摆位。

这一步不要单独转 `U`，否则会把已对齐的顶棱一起移走。四颗顶角都在正确的角槽后，进入最后一步。

<!-- tutorial-widget:cube-stage {"title":"顶层角块归位","items":[{"title":"四颗顶角位置正确","content":"每颗角都属于所在的角槽，顶面贴纸还可能朝向侧面。","facelets":"LURUUUFUFURBRRRRRRLFRFFFFFFDDDDDDDDDBLULLLLLLUBUBBBBBB"}]} -->

## 第八步：翻正顶层角块

固定正面，把一颗顶面贴纸未朝上的顶角放到右前上方。

<!-- tutorial-widget:cube-stage {"title":"翻正顶层角块","items":[{"title":"处理右前上角","content":"固定正面，先翻正这颗角；再只转 U 换下一颗。","facelets":"LURUUUFUFURBRRRRRRLFRFFFFFFDDDDDDDDDBLULLLLLLUBUBBBBBB"}]} -->

1. 对右前上角重复 `R' D' R D`，直到它的顶面贴纸朝上。每组四步必须做完整。
2. **只转动 `U`**，把下一颗未翻正的顶角送到右前上方。保持整颗魔方的朝向不变。
3. 继续处理其余顶角；全部翻正后，转动 `U` 对齐四个侧面。

中途底层和中层会被打乱。不要改握法，也不要回头修它们；四颗顶角都按同一方向处理完，前两层会一起恢复。

下面演示翻正第一颗顶角：连续做两组，直到它的顶面贴纸朝上。此时前两层尚未恢复，要继续按上面的步骤处理其余顶角。

<!-- tutorial-widget:algorithm-player {"title":"翻正一颗顶角","algorithm":"R' D' R D R' D' R D","setupAlgorithm":"U D' R' D R D' R' D R D' R' D R D' R' D R U' D' R' D R D' R' D R","note":"本例连续做两组四步，翻正右前上角。接下来只转 U 换下一颗角，不能转整颗魔方或提前修复底层。"} -->

<!-- tutorial-widget:cube-stage {"title":"复原完成","items":[{"title":"六面复原","content":"六个面分别与各自的中心块同色。","facelets":"UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"}]} -->

## 公式速查

| 步骤 | 摆位 | 公式 |
| --- | --- | --- |
| 3. 底角插入 | 目标块在右前上，目标槽在正下方 | `R U R' U'` |
| 4. 中棱右插 | 前上棱的朝前贴纸对齐，目标槽在右前 | `U R U' R' U' F' U F` |
| 4. 中棱左插 | 前上棱的朝前贴纸对齐，目标槽在左前 | `U' L' U L U F U' F'` |
| 5. 顶层十字 | 一字横放；折角在后、左 | `F R U R' U' F'` |
| 6. 顶棱换位 | 两颗已对齐的棱在后、右；做完转 `U` 对齐 | `R U R' U R U2 R'` |
| 7. 顶角换位 | 正确角放在右前上；不单独转 `U` | `U R U' L' U R' U' L` |
| 8. 顶角翻转 | 固定正面，只用 `U` 换下一颗角 | `R' D' R D` |
