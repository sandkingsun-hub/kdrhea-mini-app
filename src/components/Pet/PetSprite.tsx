import type { PetSkin, PetSpecies, PetState } from "~/types/pet";
import { View } from "@tarojs/components";
import { useEffect, useRef, useState } from "react";
import "./pet-sprite.scss";

interface Props {
  species: PetSpecies;
  skin: PetSkin | null;
  state: PetState;
  onClick?: () => void;
}

// 显示尺寸：192×208 rpx（约等于源帧 96×104 px 双倍放大）
const DISPLAY_W = 192;
const DISPLAY_H = 208;

export function PetSprite({ species, skin, state, onClick }: Props) {
  const [frameIdx, setFrameIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spriteUrl = skin?.spriteUrl || species.spriteUrl;
  const frame = species.frames[state];
  const { cols, rows } = species.spriteGrid;
  const { w: frameW, h: frameH } = species.spriteFrameSize;

  // 显示放大比例 · sprite sheet 总尺寸（rpx）
  const ratio = DISPLAY_W / frameW;
  const sheetW = frameW * cols * ratio;
  const sheetH = frameH * rows * ratio;

  // 当前帧在 sheet 中的位置
  const curCol = frame.col + frameIdx;
  const x = -curCol * frameW * ratio;
  const y = -frame.row * frameH * ratio;

  useEffect(() => {
    setFrameIdx(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (frame.count > 1) {
      const ms = 1000 / frame.fps;
      timerRef.current = setInterval(() => {
        setFrameIdx(i => (i + 1) % frame.count);
      }, ms);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state, species._id, frame.count, frame.fps]);

  return (
    <View className="pet-sprite-container" onClick={onClick}>
      <View
        className="pet-sprite-img"
        style={{
          width: `${DISPLAY_W}rpx`,
          height: `${DISPLAY_H}rpx`,
          backgroundImage: `url(${spriteUrl})`,
          backgroundSize: `${sheetW}rpx ${sheetH}rpx`,
          backgroundPosition: `${x}rpx ${y}rpx`,
          backgroundRepeat: "no-repeat",
        }}
      />
      {state === "sleeping" && <View className="pet-sprite-zzz">z</View>}
    </View>
  );
}
