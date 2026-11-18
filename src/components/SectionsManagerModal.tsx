import React from "react";
import { Modal } from "react-native";
import CategoriesScreen from "../screens/CategoriesScreen";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SectionsManagerModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <CategoriesScreen onBack={onClose} />
    </Modal>
  );
}
