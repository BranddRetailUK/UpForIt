import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountProfileForm from "../../components/AccountProfileForm";
import CloudinaryImage from "../../components/CloudinaryImage";
import LogoutButton from "../../components/LogoutButton";
import MerchImage from "../../components/MerchImage";
import { getCurrentUser } from "../../lib/auth";
import { CLOUDINARY_ASSETS } from "../../lib/cloudinary";
import { getPool } from "../../lib/db";
import { formatMerchMoney, getMerchAccountOrders, type MerchAccountOrder } from "../../lib/merch";
import { getMerchDiscountEntitlement } from "../../lib/merch-discounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_minor: number;
  created_at: Date;
  event_title: string;
  venue_name: string;
  starts_at: Date;
  timezone: string;
  ticket_count: string;
};

type AccountRow = { created_at: Date };

const accountDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function ticketStatusLabel(status: string) {
  if (status === "refunded") return "Refunded";
  if (status === "refund_review") return "Refund under review";
  return "Tickets ready";
}

function merchStatusLabel(status: MerchAccountOrder["status"]) {
  return {
    processing: "Processing",
    shipped: "On the way",
    delivered: "Delivered",
    refunded: "Refunded",
    cancelled: "Cancelled"
  }[status];
}

function safeDate(value: string | null) {
  return value ? accountDate.format(new Date(value)) : "Date unavailable";
}

async function loadMerchOrders(accountId: string, email: string) {
  try {
    return { available: true, orders: await getMerchAccountOrders({ accountId, email }) };
  } catch (error) {
    console.error("[account-merch-orders]", error instanceof Error ? error.message : error);
    return { available: false, orders: [] as MerchAccountOrder[] };
  }
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");

  const [ordersResult, accountResult, discount, merchHistory] = await Promise.all([
    getPool().query<OrderRow>(
      `SELECT o.id, o.order_number, o.status, o.total_minor, o.created_at,
              e.title AS event_title, e.venue_name, e.starts_at, e.timezone,
              count(t.id)::text AS ticket_count
         FROM ticket_orders o
         JOIN events e ON e.id = o.event_id
         LEFT JOIN tickets t ON t.order_id = o.id
        WHERE o.user_id = $1 AND o.status IN ('paid', 'refund_review', 'refunded')
        GROUP BY o.id, e.id
        ORDER BY o.created_at DESC`,
      [user.id]
    ),
    getPool().query<AccountRow>("SELECT created_at FROM users WHERE id = $1", [user.id]),
    getMerchDiscountEntitlement(user.id),
    user.emailVerified
      ? loadMerchOrders(user.id, user.email)
      : Promise.resolve({ available: false, orders: [] as MerchAccountOrder[] })
  ]);

  const ticketOrders = ordersResult.rows;
  const firstName = user.displayName.trim().split(/\s+/)[0] || "there";
  const accountCreatedAt = accountResult.rows[0]?.created_at;
  const perkReady = discount?.status === "available" || discount?.status === "reserved";

  return (
    <div className="inner-page section-wrap account-page account-dashboard-page">
      <section className="account-panel account-panel--wide account-dashboard">
        <header className="account-dashboard__hero">
          <div className="account-dashboard__avatar" aria-hidden="true">
            <CloudinaryImage
              asset={CLOUDINARY_ASSETS.smiley}
              alt=""
              className="account-dashboard__avatar-image"
              sizes="(max-width: 700px) 68px, 96px"
              maxWidth={160}
              priority
            />
          </div>
          <div>
            <p className="comic-kicker comic-kicker--yellow">Your UPFORIT profile</p>
            <h1>Hi, {firstName}!</h1>
            <p>Tickets, merch orders and account details—all together.</p>
          </div>
        </header>

        {perkReady ? (
          <aside className="account-perk" aria-labelledby="account-perk-title">
            <div>
              <span className="account-perk__tag">Ticket-holder perk</span>
              <h2 id="account-perk-title">20% off all merch</h2>
              <p>Your ticket purchase unlocked a one-time 20% merch discount. It will be applied to your eligible merch checkout.</p>
            </div>
            <Link className="pop-button pop-button--pink" href={discount?.status === "reserved" ? "/cart" : "/merch"}>
              {discount?.status === "reserved" ? "View cart" : "Shop merch"}
            </Link>
          </aside>
        ) : null}

        <div className="account-dashboard__grid">
          <main className="account-dashboard__main">
            <section className="account-card" id="tickets">
              <div className="account-card__heading">
                <div><p className="comic-kicker comic-kicker--blue">Your entry pass</p><h2>Ticket wallet</h2></div>
                <Link href="/events">Find an event</Link>
              </div>
              {ticketOrders.length ? (
                <div className="account-ticket-list">
                  {ticketOrders.map((order) => (
                    <Link href={`/account/orders/${order.id}`} className="account-ticket" key={order.id}>
                      <div className="account-ticket__main">
                        <span className={`account-status account-status--${order.status}`}>{ticketStatusLabel(order.status)}</span>
                        <h3>{order.event_title}</h3>
                        <p>{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: order.timezone }).format(new Date(order.starts_at))}</p>
                        <small>{order.venue_name} · {order.order_number}</small>
                      </div>
                      <div className="account-ticket__meta">
                        <strong>{order.ticket_count} ticket{order.ticket_count === "1" ? "" : "s"}</strong>
                        <span>£{(order.total_minor / 100).toFixed(2)}</span>
                        <b>View tickets →</b>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="account-empty"><strong>No tickets yet</strong><p>When you buy tickets, your QR codes and downloads will appear here.</p><Link href="/events">See events →</Link></div>
              )}
            </section>

            <section className="account-card" id="merch-orders">
              <div className="account-card__heading">
                <div><p className="comic-kicker comic-kicker--pink">Your purchases</p><h2>Merch orders</h2></div>
                <Link href="/merch">Shop merch</Link>
              </div>
              {!merchHistory.available ? (
                <div className="account-empty"><strong>Merch history is taking a break</strong><p>Your ticket wallet and account are still available. Please check this section again shortly.</p></div>
              ) : merchHistory.orders.length ? (
                <div className="account-merch-list">
                  {merchHistory.orders.map((order) => (
                    <article className="account-merch-order" key={`${order.orderNumber}:${order.createdAt || "unknown"}`}>
                      <header>
                        <div><strong>{order.orderNumber}</strong><small>{safeDate(order.createdAt)}</small></div>
                        <div><span className={`account-status account-status--${order.status}`}>{merchStatusLabel(order.status)}</span><strong>{formatMerchMoney(order.totalMinor, order.currency)}</strong></div>
                      </header>
                      <div className="account-merch-order__items">
                        {order.items.map((item, index) => (
                          <div className="account-merch-item" key={`${item.title}:${item.variant}:${index}`}>
                            {item.imageUrl ? <MerchImage src={item.imageUrl} alt="" sizes="72px" /> : <span className="account-merch-item__placeholder" aria-hidden="true">UFI</span>}
                            <div><strong>{item.title}</strong>{item.variant ? <small>{item.variant}</small> : null}<small>Qty {item.quantity}</small></div>
                            <span>{formatMerchMoney(item.lineTotalMinor, order.currency)}</span>
                          </div>
                        ))}
                      </div>
                      <footer>Fulfilled by Good Game Apparel</footer>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="account-empty"><strong>No merch orders yet</strong><p>Your UPFORIT merch purchases will appear here after checkout.</p><Link href="/merch">Browse merch →</Link></div>
              )}
            </section>
          </main>

          <aside className="account-dashboard__side">
            <section className="account-card account-card--compact" id="profile">
              <div className="account-card__heading"><div><p className="comic-kicker comic-kicker--yellow">The basics</p><h2>Profile</h2></div></div>
              <AccountProfileForm displayName={user.displayName} email={user.email} />
              <div className="account-profile-facts">
                <span><b>Account status</b><strong>{user.emailVerified ? "Email verified" : "Verification needed"}</strong></span>
                {accountCreatedAt ? <span><b>Member since</b><strong>{accountDate.format(new Date(accountCreatedAt))}</strong></span> : null}
              </div>
            </section>

            <section className="account-card account-card--compact">
              <div className="account-card__heading"><div><p className="comic-kicker comic-kicker--pink">Stay secure</p><h2>Security</h2></div></div>
              <p>Reset your password by email at any time. Doing so signs out your other sessions.</p>
              <Link className="account-text-link" href="/account/forgot-password">Reset password →</Link>
              <div className="account-logout"><LogoutButton /></div>
            </section>

            {user.role !== "customer" ? (
              <section className="account-card account-card--compact">
                <div className="account-card__heading"><div><p className="comic-kicker comic-kicker--blue">Team access</p><h2>Tools</h2></div></div>
                <div className="account-actions">
                  {user.role === "admin" ? <Link className="pop-button pop-button--pink" href="/admin">Ticket admin</Link> : null}
                  <Link className="pop-button pop-button--yellow" href="/staff/events">Staff tools</Link>
                </div>
              </section>
            ) : null}

            <section className="account-card account-card--compact account-help">
              <strong>Need a hand?</strong>
              <p>For ticket or account questions, visit our contact page.</p>
              <Link className="account-text-link" href="/contact">Get help →</Link>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
