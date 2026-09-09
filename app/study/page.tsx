import type { Metadata } from "next";
import { auth } from "@/app/lib/auth";
import { isOwner } from "@/app/lib/session";
import ReaderApp from "@/app/components/ReaderApp";

export const metadata: Metadata = {
  title: "the study — bahar's house",
  description: "The bookshelf: what I'm reading, and where I read it.",
};

// The study is just the library, open to everyone. Signing in unlocks
// editing (adding/removing books, writing notes, synced progress).
export default async function StudyPage() {
  const session = await auth();
  const user = session?.user;
  const canManageBooks = await isOwner();

  return (
    <ReaderApp
      currentUser={
        user ? { id: user.id, name: user.name ?? user.email ?? "You" } : null
      }
      canManageBooks={canManageBooks}
    />
  );
}
