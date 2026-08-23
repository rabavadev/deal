import { Suspense } from "react";
import Directory from "@/components/Directory";
import { TOOLS } from "@/lib/tools";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <Suspense>
        <Directory tools={TOOLS} />
      </Suspense>
    </div>
  );
}
