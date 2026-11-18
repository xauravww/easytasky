import React from "react";
import { Modal } from "react-native";
import SettingsScreen from "../screens/SettingsScreen";

type Props = {
  initialTab?: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function SettingsModal({ onClose, onSaved }: Props) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SettingsScreen onBack={onClose} onSaved={onSaved} />
    </Modal>
  );
}
