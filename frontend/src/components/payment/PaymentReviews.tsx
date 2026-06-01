import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useRotatingBucket } from "../../hooks/useRotatingBucket";
import {
  getPaymentReviewsForBucket,
  PAYMENT_REVIEW_ROTATION_MS,
} from "../../lib/paymentReviews";

interface PaymentReviewsProps {
  preferredProfession?: string;
}

export function PaymentReviews({ preferredProfession }: PaymentReviewsProps) {
  const bucket = useRotatingBucket(PAYMENT_REVIEW_ROTATION_MS);
  const reviews = useMemo(
    () => getPaymentReviewsForBucket(bucket, 3, preferredProfession),
    [bucket, preferredProfession],
  );

  return (
    <div className="payment-quotes">
      <p className="payment-quotes-title">Отзывы пользователей</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={bucket}
          className="payment-quotes-list"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {reviews.map((quote, idx) => (
            <motion.div
              key={quote.id}
              className="payment-quote"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: idx * 0.05 }}
            >
              <p className="payment-quote-text">«{quote.text}»</p>
              <p className="payment-quote-role">{quote.role}</p>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
      <p className="payment-quotes-footnote">
        Отзывы написаны по желанию в ЛС основателю!
      </p>
    </div>
  );
}
