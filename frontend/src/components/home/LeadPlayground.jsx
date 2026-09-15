import { useEffect, useReducer, useRef } from "react";
import { ArrowRight, Check, MessageSquare, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

const scenarios = [
    {
        id: "understand",
        name: "Maya Rao",
        initials: "MR",
        source: "A new conversation",
        quote: "I saw your post. Is this useful for someone just starting out?",
        prompt: "What is your next move?",
        status: "New lead",
        choices: [
            {
                label: "Send every detail at once",
                hint: "The full introduction, all in one message.",
                helpful: false,
                title: "Start with a little context.",
                explanation: "A long pitch may miss what Maya actually needs. Ask about her goals, then keep the useful details in her lead notes.",
                outcome: "Her goal is still unknown",
            },
            {
                label: "Ask what she wants to achieve",
                hint: "Understand the person behind the enquiry.",
                helpful: true,
                title: "A conversation worth building on.",
                explanation: "Now there is something useful to remember. Lead notes keep that context beside the contact, ready for the next conversation.",
                outcome: "Context captured in lead notes",
            },
            {
                label: "Mark the lead as qualified",
                hint: "Move the record forward immediately.",
                helpful: false,
                title: "Interest is a starting point.",
                explanation: "An enquiry alone does not establish a good fit. Learn a little more before changing the lead's pipeline stage.",
                outcome: "Qualification still needs a conversation",
            },
        ],
    },
    {
        id: "schedule",
        name: "Arjun Mehta",
        initials: "AM",
        source: "A conversation to pick up",
        quote: "Tomorrow after 6 works for a quick call.",
        prompt: "Where should this next step live?",
        status: "Contacted",
        choices: [
            {
                label: "Keep it in the notes",
                hint: "Save the message for later.",
                helpful: false,
                title: "Useful context needs a next step.",
                explanation: "A note records the conversation, but it does not create a dated task. Schedule a follow-up so the call appears in your pending work.",
                outcome: "A note exists; no call is scheduled",
            },
            {
                label: "Call again right now",
                hint: "Get it done while the conversation is fresh.",
                helpful: false,
                title: "Use the time you agreed on.",
                explanation: "Arjun has given you a useful time window. A dated follow-up helps you keep that agreement without relying on memory.",
                outcome: "The agreed time still needs a task",
            },
            {
                label: "Schedule tomorrow at 6:30 PM",
                hint: "Give the call a place in the task list.",
                helpful: true,
                title: "A promise becomes a plan.",
                explanation: "The call now has a due date. LeadFlow puts dated follow-ups in the matching task views and keeps the lead's next follow-up in sync.",
                outcome: "Call scheduled · Tomorrow, 6:30 PM",
            },
        ],
    },
    {
        id: "close",
        name: "Sara Khan",
        initials: "SK",
        source: "An outcome to record",
        quote: "I've decided not to continue. Please don't follow up.",
        prompt: "How do you wrap up this conversation?",
        status: "Contacted",
        choices: [
            {
                label: "Record the outcome and stop follow-ups",
                hint: "Respect the decision and keep the history.",
                helpful: true,
                title: "A clear ending is progress, too.",
                explanation: "In your workspace, record the outcome, update the lead's status, and cancel its pending follow-ups. The history stays useful without scheduling more contact.",
                outcome: "Outcome recorded · follow-up cancelled",
            },
            {
                label: "Try another call next week",
                hint: "Put the conversation back on the calendar.",
                helpful: false,
                title: "The next move can be to stop.",
                explanation: "Sara has asked for no more follow-ups. Record that decision and cancel pending tasks instead of scheduling another conversation.",
                outcome: "Her request still needs to be recorded",
            },
            {
                label: "Leave everything pending",
                hint: "Move on without updating the workspace.",
                helpful: false,
                title: "Give the workspace a clear ending.",
                explanation: "An old pending task can bring a closed conversation back into your day. Recording the outcome and cancelling the task keeps the list useful.",
                outcome: "An unnecessary follow-up is still pending",
            },
        ],
    },
];

const initialRound = {
    index: 0,
    selected: null,
    helpfulMoves: 0,
    finished: false,
};

function roundReducer(state, action) {
    if (action.type === "choose") {
        if (state.finished || state.selected !== null) return state;
        const choice = scenarios[state.index].choices[action.index];
        if (!choice) return state;
        return {
            ...state,
            selected: action.index,
            helpfulMoves: state.helpfulMoves + Number(choice.helpful),
        };
    }
    if (action.type === "next") {
        if (state.finished || state.selected === null) return state;
        return state.index === scenarios.length - 1
            ? { ...state, finished: true } : { ...state, index: state.index + 1, selected: null };
    }
    if (action.type === "restart") return initialRound;
    return state;
}

function LeadPlayground({ accountHref, accountLabel }) {
    const [round, dispatch] = useReducer(roundReducer, initialRound);
    const headingRef = useRef(null);
    const feedbackRef = useRef(null);
    const interactedRef = useRef(false);
    const scenario = scenarios[round.index];
    const selectedChoice = round.selected === null ? null : scenario.choices[round.selected];
    const answeredCount = round.finished ? 3 : round.index + Number(selectedChoice !== null);

    // Move focus only after a visitor acts; never steal focus on initial page load.
    useEffect(() => {
        if (!interactedRef.current) return;
        const target = selectedChoice && !round.finished ? feedbackRef : headingRef;
        target.current?.focus({ preventScroll: true });
        target.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }, [round.index, round.selected, round.finished, selectedChoice]);

    const act = (action) => {
        interactedRef.current = true;
        dispatch(action);
    };

    return (
        <section id="lead-playground" className="lf-playground" aria-label="The Next Move interactive demo" tabIndex={-1} >
            <div className="lf-playground-top">
                <span className="lf-window-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </span>
                <span>The Next Move</span>
                <span className="lf-demo-label">PLAYABLE DEMO</span>
            </div>

            <div className="lf-playground-body">
                <div className="lf-round-meta">
                    <span>
                        {round.finished ? "ROUND COMPLETE" : `YOUR SAMPLE INBOX · ${round.index + 1} OF 3`}
                    </span>
                    <div
                        className="lf-round-progress"
                        role="progressbar"
                        aria-label="Conversations considered"
                        aria-valuemin={0}
                        aria-valuemax={3}
                        aria-valuenow={answeredCount}
                    >
                        {scenarios.map((item, index) => (
                            <span key={item.id}
                                className={
                                    round.finished || index < round.index
                                        ? "is-done" : index === round.index
                                            ? "is-current" : ""
                                }
                            />
                        ))}
                    </div>
                </div>

                {round.finished ? (
                    <div className="lf-round-end">
                        <div className="lf-result-art" aria-hidden="true">
                            <span className="lf-result-orbit" />
                            <Check size={40} strokeWidth={2} />
                            <span className="lf-result-spark lf-result-spark-one">+</span>
                            <span className="lf-result-spark lf-result-spark-two">+</span>
                        </div>

                        <p className="lf-eyebrow">ONE SMALL INBOX, A LITTLE MORE CLARITY</p>

                        <h2 ref={headingRef} tabIndex={-1}>
                            Your round, wrapped up.
                        </h2>

                        <p className="lf-round-score">
                            <strong>
                                {round.helpfulMoves}
                                <span>/3</span>
                            </strong>{" "}
                            helpful first moves
                        </p>

                        <p>
                            Understand the person. Give the next step a date. Keep the outcome. That is the rhythm LeadFlow helps you organize.
                        </p>

                        <Link className="lf-button lf-button-primary lf-button-full" to={accountHref} >
                            {accountLabel}
                            <ArrowRight size={17} aria-hidden="true" />
                        </Link>

                        <button className="lf-replay-button" type="button" onClick={() => act({ type: "restart" })} >
                            <RotateCcw size={15} aria-hidden="true" /> Play another round
                        </button>
                    </div>
                ) : (
                    <div className="lf-scenario" key={scenario.id}>
                        <div className="lf-person-row">
                            <span className={`lf-avatar lf-avatar-${scenario.id}`} aria-hidden="true" >
                                {scenario.initials}
                            </span>

                            <div>
                                <h2>{scenario.name}</h2>
                                <p>{scenario.source}</p>
                            </div>

                            <span className="lf-lead-status">{scenario.status}</span>
                        </div>

                        <blockquote className="lf-message">
                            <MessageSquare size={18} aria-hidden="true" />
                            <p>“{scenario.quote}”</p>
                        </blockquote>

                        <h3 className="lf-decision-title" ref={headingRef} tabIndex={-1}>
                            {scenario.prompt}
                        </h3>

                        <div className="lf-choices" role="group" aria-label="Choose a next move" >
                            {scenario.choices.map((choice, index) => (
                                <button
                                    key={choice.label}
                                    type="button"
                                    className={`lf-choice ${round.selected === index ? "is-selected" : ""}`}
                                    onClick={() => act({ type: "choose", index })}
                                    disabled={selectedChoice !== null}
                                    aria-pressed={round.selected === index}
                                >
                                    <span className="lf-choice-number" aria-hidden="true">
                                        {round.selected === index ? (
                                            <Check size={15} />
                                        ) : (
                                            `0${index + 1}`
                                        )}
                                    </span>

                                    <span>
                                        <strong>{choice.label}</strong>
                                        <small>{choice.hint}</small>
                                    </span>

                                    <ArrowRight className="lf-choice-arrow" size={16} aria-hidden="true" />
                                </button>
                            ))}
                        </div>

                        {selectedChoice && (
                            <div className={`lf-feedback ${selectedChoice.helpful ? "lf-feedback-helpful" : ""}`} >
                                <h3 ref={feedbackRef} tabIndex={-1}>
                                    {selectedChoice.title}
                                </h3>

                                <p>{selectedChoice.explanation}</p>

                                <div className="lf-demo-outcome">
                                    <span aria-hidden="true" />
                                    {selectedChoice.outcome}
                                </div>

                                <button className="lf-button lf-button-ink lf-button-full" type="button" onClick={() => act({ type: "next" })} >
                                    {round.index === scenarios.length - 1
                                        ? "See my round" : "Next conversation"}
                                    <ArrowRight size={16} aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        {!selectedChoice && (
                            <p className="lf-play-hint">Pick a move. See what it changes.</p>
                        )}
                    </div>
                )}
            </div>
            <p className="lf-demo-footnote">
                Fictional records. Nothing here changes your account.
            </p>
        </section>
    );
}

export default LeadPlayground;
