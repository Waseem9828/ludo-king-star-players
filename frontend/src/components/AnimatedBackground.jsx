import React from "react";
import "./AnimatedBackground.css";

export default function AnimatedBackground() {
  return (
    <div className="game-bg">
      {/* Glows */}
      <div className="orb orb-blue"></div>
      <div className="orb orb-green"></div>
      <div className="orb orb-yellow"></div>

      {/* Grid */}
      <div className="grid"></div>

      {/* Dots */}
      <div className="dots dots-left"></div>
      <div className="dots dots-right"></div>

      {/* Ludo Shapes */}
      <div className="ludo-shape blue-shape"></div>
      <div className="ludo-shape green-shape"></div>
      <div className="ludo-shape red-shape"></div>
      <div className="ludo-shape yellow-shape"></div>

      {/* Dice */}
      <div className="dice dice-one"></div>
      <div className="dice dice-two"></div>

      {/* Rings */}
      <div className="ring ring-one"></div>
      <div className="ring ring-two"></div>

      {/* Particles */}
      <div className="particle p1"></div>
      <div className="particle p2"></div>
      <div className="particle p3"></div>
      <div className="particle p4"></div>
      <div className="particle p5"></div>

      {/* Bottom glow */}
      <div className="bottom-light"></div>
    </div>
  );
}
