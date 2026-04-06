"use client";

import dynamic from "next/dynamic";

const HomeShell = dynamic(
  () => import("@/components/home-shell").then((module) => module.HomeShell),
  {
    ssr: false,
    loading: () => <div className="h-dvh w-full bg-cc-bg" />,
  },
);

export default function Home() {
  return <HomeShell />;
}
