"use client";

import dynamic from "next/dynamic";

const HomeShell = dynamic(
  () => import("@/components/home-shell").then((module) => module.HomeShell),
  {
    ssr: false,
    loading: () => <div className="h-dvh w-full" />,
  },
);

export function HomeShellLoader() {
  return <HomeShell />;
}
