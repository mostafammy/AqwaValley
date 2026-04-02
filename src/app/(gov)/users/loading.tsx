import { Skeleton } from "~/app/_components/UI/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Skeleton className="h-12 w-12" />
    </div>
  );
}