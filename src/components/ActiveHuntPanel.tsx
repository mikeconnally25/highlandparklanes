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
import styles from "./ActiveHuntPanel.module.css";

export function ActiveHuntPanel() {
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
    <div className={styles.board}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Bonus Hunts</p>
          {canManage ? (
            <input
              className={styles.huntTitleInput}
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
              aria-label="Hunt number"
            />
          ) : (
            <h1 className={styles.huntTitle}>
              {state?.title?.trim() || "Live hunt board"}
            </h1>
          )}
          <p className={styles.heroLead}>
            Slot requests, hunt list, and break-even — ready for stream.
          </p>
        </div>

        <div className={styles.statusCluster}>
          {canManage ? (
            <>
              <div className={styles.toggleGroup} role="group" aria-label="Hunt">
                <button
                  type="button"
                  className={styles.toggle}
                  data-active={!huntActive || undefined}
                  aria-pressed={!huntActive}
                  disabled={busy}
                  onClick={() => void setHuntLive(false)}
                >
                  Idle
                </button>
                <button
                  type="button"
                  className={styles.toggle}
                  data-on={huntActive || undefined}
                  data-active={huntActive || undefined}
                  aria-pressed={huntActive}
                  disabled={busy}
                  onClick={() => void setHuntLive(true)}
                >
                  Active
                </button>
              </div>
              <div
                className={styles.toggleGroup}
                role="group"
                aria-label="Requests"
              >
                <button
                  type="button"
                  className={styles.toggle}
                  data-active={!requestsOpen || undefined}
                  aria-pressed={!requestsOpen}
                  disabled={busy}
                  onClick={() => void setHuntLive(false)}
                >
                  Closed
                </button>
                <button
                  type="button"
                  className={styles.toggle}
                  data-on={requestsOpen || undefined}
                  data-active={requestsOpen || undefined}
                  aria-pressed={requestsOpen}
                  disabled={busy}
                  onClick={() => void setHuntLive(true)}
                >
                  Requests open
                </button>
              </div>
            </>
          ) : (
            <>
              <span
                className={styles.badge}
                data-on={huntActive || undefined}
              >
                {huntActive ? "Hunt active" : "Hunt idle"}
              </span>
              <span
                className={styles.badge}
                data-on={requestsOpen || undefined}
              >
                {requestsOpen ? "Requests open" : "Requests closed"}
              </span>
            </>
          )}
        </div>
      </header>

      {canManage && lastChatError ? (
        <p className={styles.alert} role="status">
          {lastChatError}
        </p>
      ) : null}

      <section className={styles.stats} aria-label="Hunt stats">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Started with</p>
          {canManage ? (
            <div className={styles.startRow}>
              <input
                className={styles.input}
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
                  const next = {
                    ...base,
                    startAmount: parsed,
                    updatedAt: new Date().toISOString(),
                  };
                  stateRef.current = next;
                }}
                onBlur={() => {
                  formFocusedRef.current = false;
                  void saveStartAmount();
                }}
                placeholder="e.g. 500"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void saveStartAmount()}
              >
                Save
              </button>
            </div>
          ) : (
            <p className={styles.statValue}>
              {formatBetSize(stats?.startAmount ?? null)}
            </p>
          )}
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Avg x opened</p>
          <p className={styles.statValue}>
            {formatMultiplier(stats?.avgXOpened ?? null)}
          </p>
          <p className={styles.statHint}>
            {stats?.openedCount
              ? `${stats.openedCount} opened`
              : "Log wins below"}
          </p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Break even</p>
          <p className={styles.statValue}>{breakEvenLabel}</p>
          <p className={styles.statHint}>
            {stats?.breakEvenReached
              ? "Recovered"
              : stats?.startAmount != null && stats.totalBet > 0
                ? `${formatBetSize(stats.startAmount)} ÷ ${formatBetSize(stats.totalBet)}`
                : "Needs start + bets"}
          </p>
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="queue-heading">
          <div className={styles.panelHead}>
            <h2 id="queue-heading" className={styles.panelTitle}>
              Chat requests
            </h2>
            <span className={styles.count}>{slotRequests.length}</span>
          </div>
          <p className={styles.help}>
            Viewers type <code>!s Slot Name</code> when requests are open.
          </p>
          {slotRequests.length === 0 ? (
            <p className={styles.empty}>No requests yet.</p>
          ) : (
            <ul className={styles.requestList}>
              {slotRequests.map((req, index) => {
                const selected = activeSelectedRequestId === req.id;
                return (
                  <li key={req.id} className={styles.requestItem}>
                    {canManage ? (
                      <button
                        type="button"
                        className={styles.requestBtn}
                        data-selected={selected || undefined}
                        disabled={busy}
                        onClick={() => selectRequest(req.id, req.slotName)}
                        aria-pressed={selected}
                      >
                        <span className={styles.index}>{index + 1}</span>
                        <SlotThumbnail
                          name={req.slotName}
                          thumbnailUrl={req.thumbnailUrl}
                        />
                        <span className={styles.requestMeta}>
                          <span className={styles.requestUser}>
                            @{req.username}
                          </span>
                          <span className={styles.requestSlot}>
                            {req.slotName}
                          </span>
                        </span>
                        <span className={styles.selectHint}>
                          {selected ? "Selected" : "Select"}
                        </span>
                      </button>
                    ) : (
                      <div className={styles.requestBtn}>
                        <span className={styles.index}>{index + 1}</span>
                        <SlotThumbnail
                          name={req.slotName}
                          thumbnailUrl={req.thumbnailUrl}
                        />
                        <span className={styles.requestMeta}>
                          <span className={styles.requestUser}>
                            @{req.username}
                          </span>
                          <span className={styles.requestSlot}>
                            {req.slotName}
                          </span>
                        </span>
                      </div>
                    )}
                    {canManage ? (
                      <button
                        type="button"
                        className={styles.iconBtn}
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

        <section className={styles.panel} aria-labelledby="list-heading">
          <div className={styles.panelHead}>
            <h2 id="list-heading" className={styles.panelTitle}>
              Hunt list
            </h2>
            <span className={styles.count}>{bonuses.length}</span>
          </div>

          {canManage ? (
            <form
              className={styles.addForm}
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
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Slot
                  <input
                    className={styles.input}
                    type="text"
                    value={bonusName}
                    onChange={(e) => {
                      setBonusName(e.target.value);
                      setSelectedRequestId(null);
                    }}
                    placeholder="Select request or type name"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className={styles.label}>
                  Bet
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={betSize}
                    onChange={(e) => setBetSize(e.target.value)}
                    placeholder=".20"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className={styles.label}>
                  Win
                  <input
                    className={styles.input}
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
              <div className={styles.formActions}>
                <div className={styles.tierRow} role="group" aria-label="Tier">
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
                  className={styles.primaryBtn}
                  disabled={busy || !bonusName.trim()}
                >
                  {activeSelectedRequestId ? "Add selected" : "Add to list"}
                </button>
              </div>
            </form>
          ) : null}

          {bonuses.length === 0 ? (
            <p className={styles.empty}>No bonuses on the list yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Break even</th>
                    <th scope="col">Slot</th>
                    <th scope="col">Bet</th>
                    <th scope="col">Win</th>
                    {canManage ? <th scope="col" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map((bonus, index) => (
                    <tr
                      key={bonus.id}
                      data-tier={
                        bonus.tier !== "normal" ? bonus.tier : undefined
                      }
                      data-new={bonus.id === newBonusId || undefined}
                    >
                      <td>{index + 1}</td>
                      <td>{breakEvenLabel}</td>
                      <td>
                        <span className={styles.slotName}>{bonus.name}</span>
                        {bonus.requestedBy ? (
                          <span className={styles.requester}>
                            @{bonus.requestedBy}
                          </span>
                        ) : null}
                      </td>
                      <td>{formatBetSize(bonus.betSize)}</td>
                      <td>
                        {canManage ? (
                          <div className={styles.winEditor}>
                            <input
                              className={styles.winInput}
                              type="text"
                              inputMode="decimal"
                              value={winDrafts[bonus.id] ?? ""}
                              onChange={(e) =>
                                setWinDrafts((current) => ({
                                  ...current,
                                  [bonus.id]: e.target.value,
                                }))
                              }
                              placeholder="0"
                              aria-label={`Win for ${bonus.name}`}
                            />
                            <button
                              type="button"
                              className={styles.winSave}
                              disabled={busy}
                              onClick={() => void saveWinAmount(bonus.id)}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          formatBetSize(bonus.winAmount)
                        )}
                      </td>
                      {canManage ? (
                        <td>
                          <button
                            type="button"
                            className={styles.iconBtn}
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
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {canManage ? (
        <section className={styles.controls} aria-label="Streamer controls">
          <button
            type="button"
            className={styles.controlsToggle}
            aria-expanded={showAdmin}
            onClick={() => setShowAdmin((value) => !value)}
          >
            Streamer controls
            <span
              className={styles.chevron}
              data-open={showAdmin || undefined}
            />
          </button>

          {showAdmin ? (
            <div className={styles.controlsBody}>
              <div className={styles.controlActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy}
                  onClick={() =>
                    void adminRequest("/api/bonus-hunt/bonus/remove", {
                      all: true,
                    })
                  }
                >
                  Clear bonuses
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
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
                  className={styles.dangerBtn}
                  disabled={busy || !canEndHunt}
                  onClick={() => void endHunt()}
                >
                  End hunt
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy || Boolean(slotCatalog?.refreshing)}
                  onClick={() => void refreshSlotCatalog()}
                >
                  {slotCatalog?.refreshing
                    ? "Refreshing slots…"
                    : "Refresh Stake slots"}
                </button>
              </div>

              {slotCatalog ? (
                <p className={styles.hint}>
                  Slot catalog: {slotCatalog.counts.total.toLocaleString()}{" "}
                  cached
                  {slotCatalog.updatedAt
                    ? ` · last ${new Date(slotCatalog.updatedAt).toLocaleString()}`
                    : ""}
                  {slotCatalog.lastError
                    ? ` · error: ${slotCatalog.lastError}`
                    : ""}
                </p>
              ) : null}

              {adminError ? (
                <p className={styles.alert} role="alert">
                  {adminError}
                </p>
              ) : null}

              <div className={styles.obs}>
                <p className={styles.hint}>OBS overlays</p>
                <ObsOverlayPreview board={state} />
                <ObsOverlayLink />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
