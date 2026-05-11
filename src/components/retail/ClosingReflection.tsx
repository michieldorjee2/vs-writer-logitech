/**
 * ClosingReflection — italic prose moment after the appointment block.
 * Reads like the last paragraph of an editor's letter.
 */

interface Props {
  body: string;
}

export default function ClosingReflection({ body }: Props) {
  return (
    <section className="retail-closing" aria-labelledby="closing-heading">
      <div className="retail-closing__inner">
        <span className="retail-fleuron" aria-hidden="true">❧</span>
        <p id="closing-heading" className="retail-closing__body retail-italic" data-retail-reveal>
          {body}
        </p>
      </div>
    </section>
  );
}
