"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * QR encodes the current week's coupon code.
 * A brand-new code (and QR image) is minted every 7 days.
 */
export function CouponQR({ code }: { code: string }) {
  return (
    <div className="rounded-lg bg-pin p-3 inline-block" key={code}>
      <QRCodeSVG value={code} size={168} level="M" includeMargin={false} />
    </div>
  );
}
