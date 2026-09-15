import { useEffect, useRef, useState } from "react";
import {
    ArrowRight,
    ArrowUpRight,
    CalendarDays,
    Check,
    ListTodo,
    MessageSquare,
    Target,
    Users,
    Waypoints,
} from "lucide-react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import LeadPlayground from "../components/home/LeadPlayground";
import "../styles/home.css";

const features = [
    {
        id: "leads",
        icon: Users,
        title: "Every conversation has context.",
        label: "Your leads",
        description: "Keep contact details, pipeline stages, and the notes that make the next conversation easier.",
        caption: "Less searching. More remembering what matters.",
    },
    {
        id: "tasks",
        icon: ListTodo,
        title: "Give your next move a date.",
        label: "Your next moves",
        description: "Bring lead follow-ups and your own daily tasks together. See today, overdue work, and completed outcomes.",
        caption: "A clear place for the promises you make.",
    },
    {
        id: "plans",
        icon: Target,
        title: "Keep a good approach close.",
        label: "Your plans",
        description: "Save reusable pitches, target audiences, and follow-up steps in marketing-plan templates.",
        caption: "Useful structure, ready for your next conversation.",
    },
    {
        id: "history",
        icon: MessageSquare,
        title: "Pick up where you left off.",
        label: "Your history",
        description: "Read a lead's notes and activity timeline before the next call. Keep completed and cancelled follow-ups as history.",
        caption: "The useful details do not have to live in your head.",
    },
];

function WorkspacePreview({ active }) {
    if (active === "leads")
        return (
            <div className="lf-preview-content">
                <div className="lf-preview-heading">
                    <span>My leads</span>
                    <span className="lf-preview-count">3 sample records</span>
                </div>

                <div className="lf-sample-table" role="table" aria-label="Fictional lead records" >
                    <div className="lf-sample-table-head" role="row">
                        <span role="columnheader">Conversation</span>
                        <span role="columnheader">Stage</span>
                    </div>
                    {[
                        ["MR", "Maya Rao", "Webinar enquiry", "New"],
                        ["AM", "Arjun Mehta", "Call tomorrow", "Contacted"],
                        ["SK", "Sara Khan", "Outcome recorded", "Lost"],
                    ].map(([initials, name, note, status]) => (
                        <div className="lf-sample-table-row" role="row" key={name}>
                            <span className="lf-sample-person" role="cell">
                                <i aria-hidden="true">{initials}</i>
                                <span>
                                    <strong>{name}</strong>
                                    <small>{note}</small>
                                </span>
                            </span>
                            <span role="cell">
                                <span className={`lf-sample-status lf-sample-status-${status.toLowerCase()}`} >
                                    {status}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
                <div className="lf-preview-note">
                    <MessageSquare size={16} aria-hidden="true" />
                    <p>
                        <strong>A little context goes a long way.</strong> Open a lead to see its notes, next follow-up, and activity.
                    </p>
                </div>
            </div>
        );

    if (active === "tasks")
        return (
            <div className="lf-preview-content">
                <div className="lf-preview-heading">
                    <span>My next moves</span>
                    <span className="lf-preview-count">Sample task list</span>
                </div>
                <div className="lf-sample-task">
                    <span className="lf-task-marker" aria-hidden="true" />
                    <div>
                        <strong>Call Arjun after work</strong>
                        <small>Lead follow-up · Tomorrow, 6:30 PM</small>
                    </div>
                    <CalendarDays size={19} aria-hidden="true" />
                </div>
                <div className="lf-sample-task">
                    <span className="lf-task-marker" aria-hidden="true" />
                    <div>
                        <strong>Prepare tomorrow's contact list</strong>
                        <small>Personal task · No date</small>
                    </div>
                    <ListTodo size={19} aria-hidden="true" />
                </div>
                <div className="lf-sample-task lf-sample-task-done">
                    <span className="lf-task-marker" aria-hidden="true">
                        <Check size={13} />
                    </span>
                    <div>
                        <strong>Review today's conversations</strong>
                        <small>Completed · Outcome saved</small>
                    </div>
                </div>
                <div className="lf-preview-note">
                    <CalendarDays size={16} aria-hidden="true" />
                    <p>
                        <strong>One lead can have several next steps.</strong> Its earliest pending follow-up stays visible on the lead.
                    </p>
                </div>
            </div>
        );

    if (active === "plans")
        return (
            <div className="lf-preview-content">
                <div className="lf-preview-heading">
                    <span>Marketing plans</span>
                    <span className="lf-preview-count">Sample template</span>
                </div>
                <div className="lf-sample-plan">
                    <span className="lf-sample-status lf-sample-status-new">Active</span>
                    <h3>A thoughtful first conversation</h3>
                    <p>Audience: people exploring the basics</p>
                    <ol>
                        <li>
                            <span>01</span>Understand their goals
                        </li>
                        <li>
                            <span>02</span>Share a relevant introduction
                        </li>
                        <li>
                            <span>03</span>Agree on a useful next step
                        </li>
                    </ol>
                </div>
                <div className="lf-preview-note">
                    <Target size={16} aria-hidden="true" />
                    <p>
                        Reusable content and steps for your approach. Individual plan-progress tracking is planned.
                    </p>
                </div>
            </div>
        );

    return (
        <div className="lf-preview-content">
            <div className="lf-preview-heading">
                <span>Lead activity</span>
                <span className="lf-preview-count">Sample timeline</span>
            </div>
            <ol className="lf-sample-timeline">
                <li>
                    <span className="lf-timeline-dot" aria-hidden="true" />
                    <small>Today · 10:00 AM</small>
                    <strong>Follow-up completed</strong>
                    <p>Outcome: agreed to continue the conversation tomorrow.</p>
                </li>
                <li>
                    <span className="lf-timeline-dot" aria-hidden="true" />
                    <small>Today · 10:05 AM</small>
                    <strong>Scheduled a follow-up</strong>
                    <p>Tomorrow at 6:30 PM.</p>
                </li>
                <li>
                    <span className="lf-timeline-dot" aria-hidden="true" />
                    <small>Today · 10:06 AM</small>
                    <strong>Note added</strong>
                    <p>Keep the introduction brief and leave time for questions.</p>
                </li>
            </ol>
        </div>
    );
}

function HomePage() {
    const { token, user, isCheckingAuth, authCheckError } = useSelector((state) => state.auth,);
    const [activeFeature, setActiveFeature] = useState("leads");
    const [logoFailed, setLogoFailed] = useState(false);
    const tabRefs = useRef([]);
    const hasVerifiedSession = Boolean(
        token &&
        user?.isEmailVerified === true &&
        user?.isActive !== false &&
        !isCheckingAuth &&
        !authCheckError,
    );
    const accountHref = hasVerifiedSession ? "/dashboard" : "/register";
    const accountLabel = hasVerifiedSession ? "Open dashboard" : "Create your account";
    const activeContent = features.find((feature) => feature.id === activeFeature,);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = "LeadFlow — Make your next move";
        return () => {
            document.title = previousTitle;
        };
    }, []);

    const handleTabKey = (event, index) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % features.length;
        else if (event.key === "ArrowLeft")
            next = (index + features.length - 1) % features.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = features.length - 1;
        else return;
        event.preventDefault();
        setActiveFeature(features[next].id);
        tabRefs.current[next]?.focus();
    };

    return (
        <div className="lf-home">
            <a className="lf-skip-link" href="#home-main">
                Skip to content
            </a>
            <header className="lf-home-header">
                <div className="lf-shell lf-header-inner">
                    <Link to="/" className="lf-brand" aria-label="LeadFlow home">
                        {logoFailed ? (
                            <Waypoints size={29} aria-hidden="true" />
                        ) : (
                            <img src="/leadflow-logo.svg" alt="" width="34" height="34" onError={() => setLogoFailed(true)} />
                        )}
                        <span>
                            LeadFlow<span className="lf-brand-dot">.</span>
                        </span>
                    </Link>

                    <nav className="lf-public-nav" aria-label="Homepage navigation">
                        <a href="#lead-playground">Play the demo</a>
                        <a href="#inside-leadflow">Inside LeadFlow</a>
                    </nav>

                    <div className="lf-header-actions">
                        {!hasVerifiedSession && (
                            <Link to="/login" className="lf-login-link">
                                Log in
                            </Link>
                        )}
                        <Link to={accountHref} className="lf-button lf-button-ink lf-header-cta" >
                            {hasVerifiedSession ? "Dashboard" : "Get started"}
                            <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </header>

            <main id="home-main" tabIndex={-1}>
                <section className="lf-hero lf-shell" aria-labelledby="home-title">
                    <div className="lf-hero-copy">
                        <p className="lf-eyebrow lf-hero-eyebrow">
                            <span aria-hidden="true" /> A LITTLE CLARITY FOR YOUR EVERYDAY
                        </p>
                        <h1 id="home-title">
                            Every lead.
                            <br />A clear
                            <br />
                            <em>next move.</em>
                        </h1>
                        <p className="lf-hero-description">
                            Conversations, follow-ups, and the things you promised yourself you'd do. Give them a place in LeadFlow.
                        </p>
                        <div className="lf-hero-actions">
                            <a className="lf-button lf-button-primary" href="#lead-playground" >
                                Try the challenge
                                <ArrowRight size={18} aria-hidden="true" />
                            </a>
                            <Link className="lf-text-link" to={accountHref}>
                                {hasVerifiedSession ? "Open your workspace" : "Create an account"}
                                <ArrowUpRight size={17} aria-hidden="true" />
                            </Link>
                        </div>
                        <p className="lf-hero-small">
                            Three conversations. Your next move.
                            <br />
                            <span>No account needed to play.</span>
                        </p>
                        <div className="lf-margin-note" aria-hidden="true">
                            <span>
                                Small moves.
                                <br />A more organized day.
                            </span>
                            <ArrowUpRight size={28} />
                        </div>
                    </div>
                    <div className="lf-hero-game">
                        <span className="lf-playground-sticker" aria-hidden="true">
                            LESS SCROLLING, MORE DOING ↘
                        </span>
                        <LeadPlayground accountHref={accountHref} accountLabel={accountLabel} />
                    </div>
                </section>

                <section className="lf-principles" aria-label="A useful follow-up rhythm" >
                    <div className="lf-shell lf-principles-inner">
                        <span>
                            <i>01</i> Know the conversation.
                        </span>
                        <span>
                            <i>02</i> Give it a next step.
                        </span>
                        <span>
                            <i>03</i> Remember the outcome.
                        </span>
                    </div>
                </section>

                <section id="inside-leadflow" className="lf-inside lf-shell" aria-labelledby="inside-title" >
                    <div className="lf-section-heading">
                        <div>
                            <p className="lf-eyebrow">
                                YOUR WORK, WITH A LITTLE MORE ROOM TO THINK
                            </p>
                            <h2 id="inside-title">
                                Many moving parts.
                                <br />
                                <em>One place to begin.</em>
                            </h2>
                        </div>
                        <p>
                            A workspace for the practical side of building relationships. Explore a few examples.
                        </p>
                    </div>
                    <div className="lf-feature-tabs" role="tablist" aria-label="Explore LeadFlow features" >
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <button
                                    key={feature.id}
                                    ref={(element) => {
                                        tabRefs.current[index] = element;
                                    }}
                                    id={`lf-tab-${feature.id}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeFeature === feature.id}
                                    aria-controls={`lf-panel-${feature.id}`}
                                    tabIndex={activeFeature === feature.id ? 0 : -1}
                                    onKeyDown={(event) => handleTabKey(event, index)}
                                    onClick={() => setActiveFeature(feature.id)}
                                    className={activeFeature === feature.id ? "is-active" : ""}
                                >
                                    <Icon size={18} aria-hidden="true" />
                                    {feature.label}
                                </button>
                            );
                        })}
                    </div>
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            id={`lf-panel-${feature.id}`}
                            role="tabpanel"
                            aria-labelledby={`lf-tab-${feature.id}`}
                            hidden={activeFeature !== feature.id}
                            className="lf-feature-panel"
                        >
                            {activeFeature === feature.id && (
                                <>
                                    <div className="lf-feature-story">
                                        <span className="lf-feature-number" aria-hidden="true">
                                            0{features.indexOf(feature) + 1}
                                        </span>
                                        <h3>{activeContent.title}</h3>
                                        <p>{activeContent.description}</p>
                                        <span className="lf-feature-caption">
                                            {activeContent.caption}
                                        </span>
                                        <Link className="lf-text-link" to={accountHref}>
                                            {accountLabel}
                                            <ArrowUpRight size={17} aria-hidden="true" />
                                        </Link>
                                    </div>
                                    <div className="lf-workspace-preview">
                                        <div className="lf-preview-chrome">
                                            <span>
                                                <span className="lf-mini-brand" aria-hidden="true">
                                                    LF
                                                </span>
                                                Workspace preview
                                            </span>
                                            <span>FICTIONAL DATA</span>
                                        </div>
                                        <WorkspacePreview active={feature.id} />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </section>

                <section className="lf-bottom-area">
                    <div className="lf-shell lf-bottom-grid">
                        <div className="lf-faq">
                            <p className="lf-eyebrow">A FEW THINGS YOU MIGHT WONDER</p>
                            <h2>
                                Before your
                                <br />
                                <em>first move.</em>
                            </h2>
                            <details>
                                <summary>Can I explore without signing up?</summary>
                                <p>
                                    Yes. The challenge and workspace previews are open to everyone. Create an account when you want to organize your own leads and tasks.
                                </p>
                            </details>
                            <details>
                                <summary>Does the demo create real leads or tasks?</summary>
                                <p>
                                    No. These are fictional examples for this page. Playing does not create records, send messages, or change your account.
                                </p>
                            </details>
                            <details>
                                <summary>Is LeadFlow tied to one marketing brand?</summary>
                                <p>
                                    No. You can organize your contacts, follow-ups, and reusable marketing plans around your own work. Program-specific ranks and team structures are planned features.
                                </p>
                            </details>
                            <details>
                                <summary>Does it send automatic follow-up reminders?</summary>
                                <p>
                                    Current follow-ups appear in dated task views, including Today and Overdue. Automatic email reminders and notifications are planned.
                                </p>
                            </details>
                        </div>
                        <div className="lf-closing-card">
                            <span className="lf-closing-decoration" aria-hidden="true">
                                <Waypoints size={78} strokeWidth={1.3} />
                            </span>
                            <p className="lf-eyebrow">YOUR REAL WORKSPACE IS NEXT</p>
                            <h2>
                                Make a little
                                <br />
                                <em>room for progress.</em>
                            </h2>
                            <p>
                                Start with one lead. Give it a next step. Build a day you can come back to.
                            </p>
                            <Link to={accountHref} className="lf-button lf-button-light">
                                {accountLabel}
                                <ArrowUpRight size={18} aria-hidden="true" />
                            </Link>
                            {!hasVerifiedSession && (
                                <p className="lf-closing-login">
                                    Already have an account? <Link to="/login">Log in</Link>
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            <footer className="lf-home-footer lf-shell">
                <Link to="/" className="lf-footer-brand">
                    LeadFlow.
                </Link>

                <p>A clear place for your next move.</p>

                <nav aria-label="Footer navigation">
                    <a href="#lead-playground">The challenge</a>

                    <details className="lf-support">
                        <summary>Email support</summary>

                        <div className="lf-support-options">
                            <p>leadflow.support.help@gmail.com</p>

                            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=leadflow.support.help%40gmail.com&su=LeadFlow%20support"
                                target="_blank" rel="noopener noreferrer"
                            >
                                Open Gmail
                            </a>

                            <a href="mailto:leadflow.support.help@gmail.com?subject=LeadFlow%20support">
                                Use my email app
                            </a>

                            <small>
                                You can also copy the address into any email service.
                            </small>
                        </div>
                    </details>

                    <a target="_blank" rel="noopener noreferrer" href="https://github.com/PankajPraja1/LeadFlow" >
                        GitHub
                        <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                </nav>

                <span>&copy; {new Date().getFullYear()} LeadFlow</span>
            </footer>
        </div>
    );
}

export default HomePage;
