import { forwardRef, useImperativeHandle } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { scaledStrokeWidth } from "./types";
import { motion, useAnimate } from "motion/react";

const RocketIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    // Ракета не улетает, а один раз «прогревает двигатель» на месте: короткая
    // тряска корпуса и вспышка пламени, затем возврат в исходное положение.
    const start = () => {
      animate(
        ".rocket-upper",
        {
          x: [0, 1, -1, 1.2, -0.8, 0.6, -0.4, 0],
          y: [0, -1.5, -0.8, -1.8, -1.2, -1.6, -0.6, 0],
        },
        { duration: 0.6, ease: "linear" },
      );
      animate(
        ".rocket-flame",
        {
          x: [0, -1, -0.5, -1.5, -0.5, 0],
          y: [0, 1, 0.5, 1.5, 0.5, 0],
          scale: [1, 1.25, 0.9, 1.3, 1.1, 1],
          opacity: [1, 0.6, 1, 0.7, 0.9, 1],
        },
        { duration: 0.6, ease: "linear" },
      );
    };

    const stop = () => {
      animate(
        ".rocket-upper, .rocket-flame",
        { x: 0, y: 0, opacity: 1, scale: 1 },
        { duration: 0.2 },
      );
    };

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    const handleHoverStart = () => {
      start();
    };

    const handleHoverEnd = () => {
      stop();
    };

    return (
      <motion.svg
        ref={scope}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke={color}
        strokeWidth={scaledStrokeWidth(strokeWidth, 32)}
        strokeMiterlimit="10"
        className={`cursor-pointer ${className}`}
        style={{ overflow: "visible" }}
      >
        <motion.path
          className="rocket-fin-left rocket-upper"
          d="m13.299,9h-3.891c-.892,0-1.738.397-2.308,1.083l-5.1,6.139,6.31,1.51"
        />

        <motion.path
          className="rocket-fin-bottom rocket-upper"
          d="m23,18.701v3.891c0,.892-.397,1.738-1.083,2.308l-6.139,5.1-1.51-6.31"
        />

        <motion.path
          className="rocket-body rocket-upper"
          d="m14.268,23.69c7.986-2.194,14.642-9.015,15.732-21.69-12.675,1.09-19.496,7.746-21.69,15.732l5.958,5.958Z"
        />

        <motion.path
          className="rocket-trajectory rocket-upper"
          d="m19,5c4.111,1.389,6.778,4.056,8,8"
          strokeLinecap="round"
        />

        <motion.circle
          className="rocket-window rocket-upper"
          cx="19"
          cy="13"
          r="2"
          fill="currentColor"
        />

        <motion.path
          className="rocket-flame"
          d="m2,30s.707-4.95,2.121-6.364c1.172-1.172,3.071-1.172,4.243,0s1.172,3.071,0,4.243c-1.414,1.414-6.364,2.121-6.364,2.121Z"
        />
      </motion.svg>
    );
  },
);

RocketIcon.displayName = "RocketIcon";

export default RocketIcon;
