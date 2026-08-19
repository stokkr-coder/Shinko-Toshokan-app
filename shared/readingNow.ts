export type ReadingNowBook = { uid: string; title: string; author: string };
export type ReadingNowMetadata = { bookUid: string; coverUrl: string };
export type ReadingNowEvent = { bookUid: string; type: "started" | "progress" | "finished" | "abandoned" | "note"; page: number; progress: number; note: string; occurredAt: number };

export type ReadingNowItem = ReadingNowBook & { coverUrl: string; progress: number; page: number; lastUpdated: number; note: string };

export function deriveReadingNow(books: ReadingNowBook[], metadata: ReadingNowMetadata[], events: ReadingNowEvent[]): ReadingNowItem[] {
  const metadataByBook = new Map(metadata.map((item) => [item.bookUid, item]));
  return books.flatMap((book) => {
    const timeline = events.filter((event) => event.bookUid === book.uid).sort((a, b) => b.occurredAt - a.occurredAt);
    if (!timeline.length) return [];
    const lastStatus = timeline.find((event) => event.type !== "note");
    if (!lastStatus || lastStatus.type === "finished" || lastStatus.type === "abandoned") return [];
    const lastPage = timeline.find((event) => event.page > 0)?.page || 0;
    return [{ ...book, coverUrl: metadataByBook.get(book.uid)?.coverUrl || "", progress: Math.max(...timeline.map((event) => event.progress)), page: lastPage, lastUpdated: timeline[0].occurredAt, note: timeline[0].note }];
  }).sort((a, b) => b.lastUpdated - a.lastUpdated);
}
