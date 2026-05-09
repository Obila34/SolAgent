import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useRef, useState } from "react";
import { speechToText, textToSpeech } from "../services/elevenlabs";

export function useVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  async function startRecording(): Promise<void> {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone permission denied");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  }

  async function stopRecordingAndTranscribe(): Promise<string> {
    const recording = recordingRef.current;
    if (!recording) return "";
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recordingRef.current = null;
    setIsRecording(false);
    if (!uri) return "";
    try {
      return await speechToText(uri);
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  }

  async function speak(text: string): Promise<void> {
    setIsSpeaking(true);
    try {
      const uri = await textToSpeech(text);
      const sound = new Audio.Sound();
      soundRef.current = sound;
      await sound.loadAsync({ uri }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsSpeaking(false);
          void sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch {
      setIsSpeaking(false);
      throw new Error("Voice playback failed");
    }
  }

  return { isRecording, isSpeaking, startRecording, stopRecordingAndTranscribe, speak };
}
