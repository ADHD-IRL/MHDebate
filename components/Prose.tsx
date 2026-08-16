/**
 * Panel text arrives as plain paragraphs separated by blank lines. Rendering
 * it as real paragraphs rather than a single blob is the whole job — there is
 * no markdown here on purpose, so nothing the model writes can inject markup.
 */
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className={`panel-prose ${className}`}>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}
