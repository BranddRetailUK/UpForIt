import SignupForm from "./SignupForm";

export default function EventUpdatesBanner({ id = "stay-connected" }: { id?: string }) {
  return (
    <section className="event-updates-banner" id={id} aria-labelledby={`${id}-heading`}>
      <div className="event-updates-banner__inner section-wrap">
        <div className="event-updates-banner__content">
          <h2 id={`${id}-heading`}>EVENT<br /><em>UPDATES</em></h2>
          <p>Event announcements and ticket updates by email.</p>
          <SignupForm />
        </div>
      </div>
    </section>
  );
}
