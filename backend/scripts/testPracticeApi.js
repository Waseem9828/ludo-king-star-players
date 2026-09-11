import { calculateNewPosition, getMovableTokens, processCapture, checkWinCondition } from "../utils/practiceLudoEngine.js";

async function testPracticeBackend() {
  console.log("=== Comprehensive Practice Mode Game Logic & Rules Test ===");

  // 1. Home Base Opening (6 required)
  console.log("\n1. Testing Home Base Opening (Dice 6 required)...");
  const redOpen6 = calculateNewPosition("red", 0, 6);
  const redOpen5 = calculateNewPosition("red", 0, 5);
  console.log("Red Base + 6 ->", redOpen6, "(Expected: 1)");
  console.log("Red Base + 5 ->", redOpen5, "(Expected: null)");
  if (redOpen6 !== 1 || redOpen5 !== null) throw new Error("Home opening rule failed");

  const greenOpen6 = calculateNewPosition("green", 0, 6);
  console.log("Green Base + 6 ->", greenOpen6, "(Expected: 14)");
  if (greenOpen6 !== 14) throw new Error("Green starting cell failed");

  const blueOpen6 = calculateNewPosition("blue", 0, 6);
  console.log("Blue Base + 6 ->", blueOpen6, "(Expected: 40)");
  if (blueOpen6 !== 40) throw new Error("Blue starting cell failed");

  // 2. Track Movement & Gate Turn-in
  console.log("\n2. Testing Track Movement & Gate Turn-in into Home Stretch...");
  // Blue Gate is cell 38. Blue token at cell 36 + dice 4 -> 36+4=40 -> Passes gate 38 by 2 -> 400 + 2 = 402
  const blueStretch = calculateNewPosition("blue", 36, 4);
  console.log("Blue pos 36 + dice 4 ->", blueStretch, "(Expected: 402)");
  if (blueStretch !== 402) throw new Error("Blue stretch entry failed");

  // 3. Track Wrap Around (52 -> 1)
  console.log("\n3. Testing Track Wrap-Around (cell 52 -> cell 1)...");
  // Green at cell 50 + dice 4 -> 50+4=54 -> 54-52=2
  const greenWrap = calculateNewPosition("green", 50, 4);
  console.log("Green pos 50 + dice 4 ->", greenWrap, "(Expected: 2)");
  if (greenWrap !== 2) throw new Error("Track wrap around failed");

  // 4. Safe Cells Capture Bypass
  console.log("\n4. Testing Safe Spot Capture Bypass...");
  // Cell 9 is a safe cell. Red lands on 9 where Green is present -> No capture!
  const safeCapture = processCapture("red", 9, { red: { token1: 9 }, green: { token1: 9 } });
  console.log("Capture on safe spot 9 ->", safeCapture.captured, "(Expected: false)");
  if (safeCapture.captured !== false) throw new Error("Safe spot capture bypass failed");

  // 5. Normal Cell Capture
  console.log("\n5. Testing Opponent Token Capture...");
  // Cell 15 is normal. Red lands on 15 where Green is present -> Green token captured to Base 0!
  const normalCapture = processCapture("red", 15, { red: { token1: 15 }, green: { token1: 15 } });
  console.log("Capture on normal cell 15 ->", normalCapture.captured, "(Expected: true)");
  console.log("Green token position after capture ->", normalCapture.updatedTokenPositions.green.token1, "(Expected: 0)");
  if (!normalCapture.captured || normalCapture.updatedTokenPositions.green.token1 !== 0) {
    throw new Error("Opponent token capture failed");
  }

  // 6. Home Stretch Overshoot Protection
  console.log("\n6. Testing Home Stretch Overshoot Protection...");
  // Red stretch finish is 106. Token at 105 + dice 3 -> exceeds 106 -> null (Invalid move)
  const redOvershoot = calculateNewPosition("red", 105, 3);
  console.log("Red pos 105 + dice 3 ->", redOvershoot, "(Expected: null)");
  if (redOvershoot !== null) throw new Error("Home stretch overshoot rule failed");

  // 7. Win Condition Check
  console.log("\n7. Testing Win Condition Check...");
  const winState = checkWinCondition("blue", { token1: 406, token2: 406, token3: 406, token4: 406 });
  console.log("Blue 4 tokens at 406 -> Win:", winState, "(Expected: true)");
  if (!winState) throw new Error("Win condition check failed");

  console.log("\n🎉 ALL GAME-PLAYING RULES & ENGINE LOGIC PASSED 100% SUCCESSFULLY!");
}

testPracticeBackend().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
