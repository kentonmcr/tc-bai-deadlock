import "server-only";
import { embed } from "ai";
import { openrouter } from "@/lib/openrouter";

// See CLAUDE.md "Embeddings" — pinned, never change without a full
// re-embed, since the documents table's vector(1536) column and the
// similarity search assume this exact model.
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}
