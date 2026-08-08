import { seedMessages } from "@/lib/_smoke";

export default function ChannelPage() {
  const channelMessages = seedMessages
    .filter((m) => m.channelId === "general")
    .sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity));

  return (
    <main>
      <h1>Pulse — #general</h1>
      <ul>
        {channelMessages.map((m) => (
          <li key={m.id}>
            <strong>{m.authorId}</strong>: {m.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
