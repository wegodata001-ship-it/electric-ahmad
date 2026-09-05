"use client";

/** Require live GPS before field attendance punches. */
export function readGps(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("יש לאשר GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        }),
      () => reject(new Error("יש לאשר GPS")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}
