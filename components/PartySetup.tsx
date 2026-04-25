"use client";

import { useState } from "react";
import { Person } from "@/types";

const AVATAR_GRADIENTS = [
  "from-purple-500 to-blue-500",
  "from-blue-500 to-cyan-400",
  "from-cyan-400 to-emerald-400",
  "from-pink-500 to-purple-500",
  "from-orange-400 to-pink-500",
];

function initials(name: string) {
  return name.split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface Props {
  people: Person[];
  onChange: (people: Person[]) => void;
  disabled?: boolean;
}

export default function PartySetup({ people, onChange, disabled }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const add = () => {
    if (!name.trim() || !email.trim()) return;
    onChange([...people, { name: name.trim(), email: email.trim() }]);
    setName("");
    setEmail("");
    setShowForm(false);
  };

  const remove = (i: number) => onChange(people.filter((_, idx) => idx !== i));

  const cancel = () => {
    setShowForm(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="rounded-2xl bg-bunq-card border border-bunq-border p-5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">👥</span>
          <h2 className="text-white font-semibold">Who's at the table?</h2>
          {people.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-bunq-purple/20 text-bunq-purple border border-bunq-purple/30 font-medium">
              {people.length}
            </span>
          )}
        </div>
        {!showForm && !disabled && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-bunq-purple border border-bunq-purple/30 bg-bunq-purple/10 hover:bg-bunq-purple/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add person
          </button>
        )}
      </div>

      {/* People list */}
      {people.length > 0 && (
        <div className="space-y-2 mb-4">
          {people.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bunq-dark/60 border border-bunq-border/50"
            >
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-xs font-bold text-white">{initials(p.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-tight truncate">{p.name}</p>
                <p className="text-gray-500 text-xs truncate">{p.email}</p>
              </div>
              {!disabled && (
                <button
                  onClick={() => remove(i)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                  aria-label={`Remove ${p.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="pt-3 border-t border-bunq-border/50 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="flex-1 px-3 py-2 rounded-xl bg-bunq-dark border border-bunq-border text-white placeholder-gray-600 text-sm focus:outline-none focus:border-bunq-purple/60 transition-colors"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="flex-1 px-3 py-2 rounded-xl bg-bunq-dark border border-bunq-border text-white placeholder-gray-600 text-sm focus:outline-none focus:border-bunq-purple/60 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={!name.trim() || !email.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-bunq-purple/80 hover:bg-bunq-purple disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              onClick={cancel}
              className="flex-1 py-2 rounded-xl text-sm font-medium text-gray-400 bg-bunq-dark border border-bunq-border hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {people.length === 0 && !showForm && (
        <p className="text-gray-600 text-sm">
          Add your dinner companions so bunq knows where to send payment requests.
        </p>
      )}
    </div>
  );
}
