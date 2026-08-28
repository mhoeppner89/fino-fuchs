# Functional check — firefox

| Check | Result | Detail |
| --- | --- | --- |
| fino-preview runs | ✅ | fox px 187→191, moved 357.2px |
| write A (2 strokes) is accepted | ✅ | advanced=true in 501ms, index 0→1, completed=1, userStrokes=ok |
| K accepts first two strokes without finishing | ✅ | advanced=false, completion after 2 strokes=0.53 |
| K finishes on the third stroke | ✅ | index 10→11, completed=2 |
| write ß (1 long stroke) is accepted | ✅ | index 29→30, completed=3 |
| 5 crossbar alone does not finish | ✅ | advanced=false, completion=0.17 |
| 5 finishes once body stroke is added | ✅ | index 64→65 |
| scribble is not accepted as S | ✅ | advanced=false, completion=0.00, toast="Fast! Versuch es noch einmal." |
| S is accepted after clear + correct writing | ✅ | index 18→19 |
| ö base + two dots accepted | ✅ | index 57→58, dots=2 |
| write 8 (one loop) is accepted | ✅ | index 67→68 |
| failCurrent is rejected | ✅ | passed=false, index stayed=true |
| solveCurrent completes the round | ✅ | screen=finish, advanced=true |

**13/13 checks passed.** Console/page errors: 0
