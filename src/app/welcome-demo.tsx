"use client";

import { useState } from "react";
import { getDictionary, getPetCopy, type Locale } from "../lib/i18n";
import type { PetKind } from "../lib/pets";
import { POINTS_PER_ACTIVITY, petMood } from "../lib/rules";
import { MOOD_TO_SPRITE_MOOD } from "./pet";
import { PetSprite } from "./pet-sprites";

const DEMO_PETS: readonly PetKind[] = [
  "original",
  "gato",
  "cachorro",
  "raposa",
  "dragao",
];

export function WelcomeDemo({ locale = "pt" }: { locale?: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.welcome.demo;
  const pointsUnit = dict.today.pointsUnit;
  const [selectedPet, setSelectedPet] = useState<PetKind>("original");
  const [doneIds, setDoneIds] = useState<string[]>(["water", "walk"]);

  const total = t.tasks.length;
  const done = doneIds.length;
  const mood = petMood(done, total);
  const progress = Math.round((done / total) * 100);
  const points = done * POINTS_PER_ACTIVITY;
  const petCopy = getPetCopy(selectedPet, locale);

  function toggleTask(id: string) {
    setDoneIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  return (
    <section className="welcome-demo" aria-label={t.title}>
      <div className="welcome-demo-header">
        <span className="welcome-demo-badge">{t.title}</span>
        <span className={`mood mood-${mood}`} aria-live="polite">
          {t.moodLabels[mood]}
        </span>
      </div>

      <div className="welcome-demo-stage">
        <div className="welcome-demo-pet">
          <PetSprite
            kind={selectedPet}
            mood={MOOD_TO_SPRITE_MOOD[mood]}
            size={132}
            label={`${petCopy.name} — ${t.moodLabels[mood]}`}
          />
          <div className="welcome-demo-pet-meta" aria-live="polite">
            <strong>{petCopy.name}</strong>
            <p>{t.moodMessages[mood]}</p>
          </div>
        </div>

        <div className="welcome-demo-stats">
          <div className="welcome-demo-stat">
            <strong className="font-pixel">+{points}</strong>
            <span>{t.pointsLabel}</span>
          </div>
          <div className="welcome-demo-stat">
            <strong>{progress}%</strong>
            <span>{t.progressLabel}</span>
          </div>
        </div>

        <progress
          value={done}
          max={total}
          aria-label={t.progressLabel}
        />
      </div>

      <div
        className="welcome-demo-pets"
        role="group"
        aria-label={t.choosePetLabel}
      >
        {DEMO_PETS.map((kind) => {
          const copy = getPetCopy(kind, locale);
          return (
            <button
              key={kind}
              type="button"
              className="welcome-pet-chip"
              aria-pressed={selectedPet === kind}
              onClick={() => setSelectedPet(kind)}
            >
              {copy.name}
            </button>
          );
        })}
      </div>

      <p className="welcome-demo-hint">{t.hint}</p>

      <ul className="welcome-demo-tasks">
        {t.tasks.map((task) => {
          const checked = doneIds.includes(task.id);
          return (
            <li key={task.id} className={checked ? "done" : undefined}>
              <button
                type="button"
                className="welcome-demo-task-btn"
                aria-pressed={checked}
                onClick={() => toggleTask(task.id)}
              >
                <span className="welcome-task-check" aria-hidden="true">
                  {checked ? "✓" : ""}
                </span>
                <span className="welcome-task-info">
                  <span className="welcome-task-name">{task.name}</span>
                  <span className="welcome-task-meta">
                    {task.time} · +{POINTS_PER_ACTIVITY} {pointsUnit}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
