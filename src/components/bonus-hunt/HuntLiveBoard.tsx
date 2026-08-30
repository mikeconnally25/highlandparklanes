"use client";

import type { FormEvent } from "react";
import {
  formatBetSize,
  formatMultiplier,
  parseMoneyAmount,
} from "@/lib/bonus-hunt";
import { ObsOverlayLink } from "@/components/ObsOverlayLink";
import { ObsOverlayPreview } from "@/components/ObsOverlayPreview";
import { SlotThumbnail } from "@/components/SlotThumbnail";
import { useBonusHuntBoard } from "@/hooks/useBonusHuntBoard";
import styles from "./hunt-board.module.css";

export function HuntLiveBoard() {
  const board = useBonusHuntBoard();
  const {
    canManage,
    busy,
    adminError,
    lastChatError,
    showAdmin,
    setShowAdmin,
    state,
    huntActive,
    requestsOpen,
    huntTitle,
    setHuntTitle,
    startAmountInput,
    setStartAmountInput,
    bonuses,
    slotRequests,
    stats,
    breakEvenLabel,
    winDrafts,
    setWinDrafts,
    bonusName,
    setBonusName,
    betSize,
    setBetSize,
    winAmount,
    setWinAmount,
    superTier,
    epicTier,
    toggleSuper,
    toggleEpic,
    activeSelectedRequestId,
    selectRequest,
    setSelectedRequestId,
    newBonusId,
    slotCatalog,
    formFocusedRef,
    stateRef,
    adminRequest,
    handleAddBonus,
    saveStartAmount,
    saveWinAmount,
    setHuntLive,
    endHunt,
    refreshSlotCatalog,
  } = board;

  const canEndHunt = Boolean(
    state?.huntActive ||
      (state?.bonuses.length ?? 0) > 0 ||
      (state?.slotRequests.length ?? 0) > 0 ||
      state?.startAmount != null ||
      Boolean(state?.title?.trim()),
  );

  return (
    <article className={styles.board} aria-label="Live bonus hunt">
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          {canManage ? (
            <input
              className={styles.titleInput}
              type="text"
              value={huntTitle}
              onFocus={() => {
                formFocusedRef.current = true;
              }}
              onBlur={() => {
                formFocusedRef.current = false;
                const next = huntTitle.trim();
                if (next === (stateRef.current?.title ?? "").trim()) return;
                void adminRequest("/api/bonus-hunt/admin", {
                  action: "set-title",
                  title: next,
                  board: stateRef.current ?? undefined,
                });
              }}
              onChange={(e) => setHuntTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Hunt #1"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-label="Hunt title"
            />
          ) : (
            <h1 className={styles.title}>
              {state?.title?.trim() || "Live hunt board"}
            </h1>
          )}
          <p className={styles.subtitle}>
            Track slot requests, bonuses, and break-even live on stream.
          </p>
        </div>

        <div className={styles.liveFlags}>
          {canManage ? (
            <>
              <fieldset className={styles.flagGroup}>
                <legend className={styles.flagLegend}>Hunt</legend>
                <button
                  type="button"
                  className={styles.flagBtn}
                  data-active={!huntActive || undefined}
                  aria-pressed={!huntActive}
                  disabled={busy}
                  onClick={() => void setHuntLive(false)}
                >
                  Idle
                </button>
                <button
                  type="button"
                  className={styles.flagBtn}
                  data-live={huntActive || undefined}
                  data-active={huntActive || undefined}
                  aria-pressed={huntActive}
                  disabled={busy}
                  onClick={() => void setHuntLive(true)}
                >
                  Live
                </button>
              </fieldset>
              <fieldset className={styles.flagGroup}>
                <legend className={styles.flagLegend}>Chat</legend>
                <button
                  type="button"
                  className={styles.flagBtn}
                  data-active={!requestsOpen || undefined}
                  aria-pressed={!requestsOpen}
                  disabled={busy}
                  onClick={() => void setHuntLive(false)}
                >
                  Closed
                </button>
                <button
                  type="button"
                  className={styles.flagBtn}
                  data-live={requestsOpen || undefined}
                  data-active={requestsOpen || undefined}
                  aria-pressed={requestsOpen}
                  disabled={busy}
                  onClick={() => void setHuntLive(true)}
                >
                  Open
                </button>
              </fieldset>
            </>
          ) : (
            <>
              <span className={styles.chip} data-live={huntActive || undefined}>
                {huntActive ? "Hunt live" : "Hunt idle"}
              </span>
              <span
                className={styles.chip}
                data-live={requestsOpen || undefined}
              >
                {requestsOpen ? "Requests open" : "Requests closed"}
              </span>
            </>
          )}
        </div>
      </header>

      {canManage && lastChatError ? (
        <p className={styles.notice} role="status">
          {lastChatError}
        </p>
      ) : null}

      <section className={styles.metrics} aria-label="Hunt metrics">
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Started with</span>
          {canManage ? (
            <div className={styles.metricEdit}>
              <input
                className={styles.field}
                type="text"
                inputMode="decimal"
                value={startAmountInput}
                onFocus={() => {
                  formFocusedRef.current = true;
                }}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setStartAmountInput(nextValue);
                  const parsed = parseMoneyAmount(nextValue);
                  const base = stateRef.current;
                  if (!base) return;
                  stateRef.current = {
                    ...base,
                    startAmount: parsed,
                    updatedAt: new Date().toISOString(),
                  };
                }}
                onBlur={() => {
                  formFocusedRef.current = false;
                  void saveStartAmount();
                }}
                placeholder="500"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy}
                onClick={() => void saveStartAmount()}
              >
                Save
              </button>
            </div>
          ) : (
            <strong className={styles.metricValue}>
              {formatBetSize(stats?.startAmount ?? null)}
            </strong>
          )}
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg multiplier</span>
          <strong className={styles.metricValue}>
            {formatMultiplier(stats?.avgXOpened ?? null)}
          </strong>
          <span className={styles.metricNote}>
            {stats?.openedCount
              ? `${stats.openedCount} opened`
              : "Log wins to track"}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Break even</span>
          <strong className={styles.metricValue}>{breakEvenLabel}</strong>
          <span className={styles.metricNote}>
            {stats?.breakEvenReached
              ? "Recovered start"
              : stats?.startAmount != null && stats.totalBet > 0
                ? `${formatBetSize(stats.startAmount)} ÷ ${formatBetSize(stats.totalBet)}`
                : "Set start + bets"}
          </span>
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.queue} aria-labelledby="queue-label">
          <div className={styles.sectionHead}>
            <h2 id="queue-label" className={styles.sectionTitle}>
              Slot requests
            </h2>
            <span className={styles.sectionCount}>{slotRequests.length}</span>
          </div>
          <p className={styles.sectionHint}>
            Viewers send <code>!s Slot Name</code> when chat is open.
          </p>

          {slotRequests.length === 0 ? (
            <p className={styles.emptyState}>Waiting for requests…</p>
          ) : (
            <ul className={styles.queueList}>
              {slotRequests.map((req, index) => {
                const selected = activeSelectedRequestId === req.id;
                return (
                  <li key={req.id} className={styles.queueItem}>
                    {canManage ? (
                      <button
                        type="button"
                        className={styles.queueRow}
                        data-selected={selected || undefined}
                        disabled={busy}
                        onClick={() => selectRequest(req.id, req.slotName)}
                        aria-pressed={selected}
                      >
                        <span className={styles.queueIndex}>{index + 1}</span>
                        <SlotThumbnail
                          name={req.slotName}
                          thumbnailUrl={req.thumbnailUrl}
                        />
                        <span className={styles.queueMeta}>
                          <span className={styles.queueUser}>
                            @{req.username}
                          </span>
                          <span className={styles.queueSlot}>
                            {req.slotName}
                          </span>
                        </span>
                        <span className={styles.queuePick}>
                          {selected ? "Selected" : "Pick"}
                        </span>
                      </button>
                    ) : (
                      <div className={styles.queueRow}>
                        <span className={styles.queueIndex}>{index + 1}</span>
                        <SlotThumbnail
                          name={req.slotName}
                          thumbnailUrl={req.thumbnailUrl}
                        />
                        <span className={styles.queueMeta}>
                          <span className={styles.queueUser}>
                            @{req.username}
                          </span>
                          <span className={styles.queueSlot}>
                            {req.slotName}
                          </span>
                        </span>
                      </div>
                    )}
                    {canManage ? (
                      <button
                        type="button"
                        className={styles.dismissBtn}
                        disabled={busy}
                        onClick={() => {
                          if (activeSelectedRequestId === req.id) {
                            setSelectedRequestId(null);
                            setBonusName("");
                          }
                          void adminRequest("/api/bonus-hunt/admin", {
                            action: "remove-request",
                            id: req.id,
                            board: stateRef.current ?? undefined,
                          });
                        }}
                        aria-label={`Dismiss ${req.slotName}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.list} aria-labelledby="list-label">
          <div className={styles.sectionHead}>
            <h2 id="list-label" className={styles.sectionTitle}>
              Hunt list
            </h2>
            <span className={styles.sectionCount}>{bonuses.length}</span>
          </div>

          {canManage ? (
            <form
              className={styles.addBonus}
              onSubmit={(event: FormEvent) => void handleAddBonus(event)}
              onFocusCapture={() => {
                formFocusedRef.current = true;
              }}
              onBlurCapture={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  formFocusedRef.current = false;
                }
              }}
            >
              <div className={styles.addGrid}>
                <label className={styles.fieldLabel}>
                  Slot
                  <input
                    className={styles.field}
                    type="text"
                    value={bonusName}
                    onChange={(e) => {
                      setBonusName(e.target.value);
                      setSelectedRequestId(null);
                    }}
                    placeholder="Pick a request or type a name"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Bet
                  <input
                    className={styles.field}
                    type="text"
                    inputMode="decimal"
                    value={betSize}
                    onChange={(e) => setBetSize(e.target.value)}
                    placeholder=".20"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Win
                  <input
                    className={styles.field}
                    type="text"
                    inputMode="decimal"
                    value={winAmount}
                    onChange={(e) => setWinAmount(e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </div>
              <div className={styles.addActions}>
                <div className={styles.tiers} role="group" aria-label="Tier">
                  <button
                    type="button"
                    className={styles.tierBtn}
                    data-active={superTier || undefined}
                    aria-pressed={superTier}
                    onClick={toggleSuper}
                  >
                    Super
                  </button>
                  <button
                    type="button"
                    className={styles.tierBtn}
                    data-epic={epicTier || undefined}
                    data-active={epicTier || undefined}
                    aria-pressed={epicTier}
                    onClick={toggleEpic}
                  >
                    Epic
                  </button>
                </div>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={busy || !bonusName.trim()}
                >
                  {activeSelectedRequestId ? "Add selected" : "Add bonus"}
                </button>
              </div>
            </form>
          ) : null}

          {bonuses.length === 0 ? (
            <p className={styles.emptyState}>No bonuses yet — add one above.</p>
          ) : (
            <ul className={styles.bonusCards}>
              {bonuses.map((bonus, index) => (
                <li
                  key={bonus.id}
                  className={styles.bonusCard}
                  data-tier={bonus.tier !== "normal" ? bonus.tier : undefined}
                  data-new={bonus.id === newBonusId || undefined}
                >
                  <div className={styles.bonusIndex}>{index + 1}</div>
                  <div className={styles.bonusMain}>
                    <p className={styles.bonusName}>{bonus.name}</p>
                    {bonus.requestedBy ? (
                      <p className={styles.bonusBy}>@{bonus.requestedBy}</p>
                    ) : null}
                    <p className={styles.bonusBe}>BE {breakEvenLabel}</p>
                  </div>
                  <div className={styles.bonusNums}>
                    <span className={styles.bonusBet}>
                      Bet {formatBetSize(bonus.betSize)}
                    </span>
                    {canManage ? (
                      <div className={styles.winRow}>
                        <input
                          className={styles.winField}
                          type="text"
                          inputMode="decimal"
                          value={winDrafts[bonus.id] ?? ""}
                          onChange={(e) =>
                            setWinDrafts((current) => ({
                              ...current,
                              [bonus.id]: e.target.value,
                            }))
                          }
                          placeholder="Win"
                          aria-label={`Win for ${bonus.name}`}
                        />
                        <button
                          type="button"
                          className={styles.btnSmall}
                          disabled={busy}
                          onClick={() => void saveWinAmount(bonus.id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span className={styles.bonusWin}>
                        Win {formatBetSize(bonus.winAmount)}
                      </span>
                    )}
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className={styles.dismissBtn}
                      disabled={busy}
                      onClick={() =>
                        void adminRequest("/api/bonus-hunt/bonus/remove", {
                          id: bonus.id,
                          board: stateRef.current ?? undefined,
                        })
                      }
                      aria-label={`Remove ${bonus.name}`}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canManage ? (
        <section className={styles.admin} aria-label="Streamer controls">
          <button
            type="button"
            className={styles.adminToggle}
            aria-expanded={showAdmin}
            onClick={() => setShowAdmin((value) => !value)}
          >
            Streamer controls
            <span
              className={styles.adminChevron}
              data-open={showAdmin || undefined}
            />
          </button>

          {showAdmin ? (
            <div className={styles.adminBody}>
              <div className={styles.adminActions}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={busy}
                  onClick={() =>
                    void adminRequest("/api/bonus-hunt/bonus/remove", {
                      all: true,
                    })
                  }
                >
                  Clear list
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={busy}
                  onClick={() =>
                    void adminRequest("/api/bonus-hunt/admin", {
                      action: "clear-requests",
                    })
                  }
                >
                  Clear queue
                </button>
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={busy || !canEndHunt}
                  onClick={() => void endHunt()}
                >
                  End hunt
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={busy || Boolean(slotCatalog?.refreshing)}
                  onClick={() => void refreshSlotCatalog()}
                >
                  {slotCatalog?.refreshing
                    ? "Refreshing slots…"
                    : "Refresh Stake slots"}
                </button>
              </div>

              {slotCatalog ? (
                <p className={styles.adminHint}>
                  Slot catalog: {slotCatalog.counts.total.toLocaleString()} cached
                  {slotCatalog.updatedAt
                    ? ` · ${new Date(slotCatalog.updatedAt).toLocaleString()}`
                    : ""}
                  {slotCatalog.lastError
                    ? ` · ${slotCatalog.lastError}`
                    : ""}
                </p>
              ) : null}

              {adminError ? (
                <p className={styles.notice} role="alert">
                  {adminError}
                </p>
              ) : null}

              <div className={styles.obsBlock}>
                <p className={styles.adminHint}>OBS browser sources</p>
                <ObsOverlayPreview board={state} />
                <ObsOverlayLink />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
