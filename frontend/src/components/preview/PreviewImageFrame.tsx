import { motion } from "motion/react";

import { PreviewFoldImage } from "./PreviewFoldImage";

interface PreviewImageFrameProps {
  src: string;
  locked: boolean;
}

export function PreviewImageFrame({ src, locked }: PreviewImageFrameProps) {
  return (
    <motion.section
      className="preview-image-wrap preview-image-wrap--fold"
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <PreviewFoldImage src={src} locked={locked} />
    </motion.section>
  );
}
