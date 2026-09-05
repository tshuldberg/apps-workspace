import { Modal } from '../shell/Modal';

// IdentityInfoModal: a plain-words explainer of the three identity pieces, who
// can see them, and where they live. Same kid-friendly copy as the mobile app.
// Every line is honest: a name is NOT proof of identity, and nothing here lives
// on a company server. No transport claims, no fabrication.

export function IdentityInfoModal({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <Modal title="About your identity" onClose={onClose}>
      <div className="mk-info-body">
        <section className="mk-info-item">
          <h3 className="mk-info-title">Your name</h3>
          <p className="mk-muted">
            This is the name your friends see next to your messages. You can change it any time.
            A name is just a label you picked, so it is not proof of who you are. To be sure you
            are really talking to the right person, compare your safety code below.
          </p>
        </section>
        <section className="mk-info-item">
          <h3 className="mk-info-title">Your friend code</h3>
          <p className="mk-muted">
            This is how a friend finds you to connect. You can make your own by typing a word, and
            Meerkat adds some random characters on the end so nobody can guess it. Share it with
            people you want to chat with. Anyone who has it can ask to connect, so only give it to
            people you trust.
          </p>
        </section>
        <section className="mk-info-item">
          <h3 className="mk-info-title">Safety code</h3>
          <p className="mk-muted">
            This is a short code made from your device's secret key. Nobody can fake it. When you
            and a friend compare safety codes and they match, you both know for sure you are talking
            to each other and not an imposter.
          </p>
        </section>
        <section className="mk-info-item">
          <h3 className="mk-info-title">Where this lives</h3>
          <p className="mk-muted">
            Everything stays on this device, in this browser. There is no company server holding
            your account, and there is no password to forget. That also means if you clear this
            browser, this identity is gone, because only you ever had it.
          </p>
        </section>
        <section className="mk-info-item">
          <h3 className="mk-info-title">The honest promise</h3>
          <p className="mk-muted">
            Meerkat never pretends. It only shows things it can really prove on your device. It
            will not say a message was delivered or read unless that truly happened, and it will
            not say someone is verified just because they picked a nice name.
          </p>
        </section>
      </div>
    </Modal>
  );
}
