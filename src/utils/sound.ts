import { createAudioPlayer } from "expo-audio";

let completionPlayer: ReturnType<typeof createAudioPlayer> | null = null;

export const playCompletionSound = async () => {
  try {
    if (!completionPlayer) {
      completionPlayer = createAudioPlayer(require("../../assets/complete.wav"));
    }
    completionPlayer.seekTo(0);
    completionPlayer.play();
    // Graceful fallback if audio is unavailable or silenced
  } catch {
    // Graceful fallback
  }
};
