import Image from "next/image";
import { brand } from "@/config/brand";
import type { CSSProperties } from "react";

export function BrandLogo({
  light = false,
  symbol = false,
  className = "",
  size,
  textClassName = "",
}: {
  light?: boolean;
  symbol?: boolean;
  className?: string;
  size?: number;
  textClassName?: string;
}) {
  return (
    <span
      className={`brand-logo ${light ? "brand-logo-light" : "brand-logo-dark"} ${symbol ? "brand-symbol-only" : ""} ${className}`}
      style={
        size
          ? ({ "--brand-symbol-size": `${size}px` } as CSSProperties)
          : undefined
      }
    >
      <Image
        className="brand-symbol-image"
        src={brand.symbol}
        width={size ?? 40}
        height={size ?? 40}
        alt={symbol ? brand.name : ""}
        aria-hidden={symbol ? undefined : true}
        loading="eager"
        unoptimized
      />
      {!symbol && (
        <span className={`brand-name ${textClassName}`}>{brand.name}</span>
      )}
    </span>
  );
}

// Preserve the existing gift-card illustration, outside this integration's scope.
export function BrandWordmark({ light = false }: { light?: boolean }) {
  return (
    <Image
      className="brand-wordmark-image"
      src={light ? brand.logoLight : brand.logoDark}
      width={170}
      height={50}
      alt={brand.name}
      loading="eager"
      unoptimized
    />
  );
}
