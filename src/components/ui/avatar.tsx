import { cn } from "@/lib/utils";
import Image from "next/image";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
  xl: "h-14 w-14 text-lg",
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  if (src) {
    return (
      <div className={cn("relative rounded-full overflow-hidden bg-gray-100 flex-shrink-0", sizes[size], className)}>
        <Image src={src} alt={name} fill className="object-cover" unoptimized />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary-100 text-primary-700 font-medium flex items-center justify-center flex-shrink-0",
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
