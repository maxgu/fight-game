import { useState, useEffect } from 'react';

// --- Sprite Animator ---
function SpriteAnimator({ src, row, startFrame, frames, size = 64, speed = 300, flipX = false }) {
    const [frame, setFrame] = useState(0);
    useEffect(() => { setFrame(0); }, [row, startFrame]);
    useEffect(() => {
        const interval = setInterval(() => setFrame(f => (f + 1) % frames), speed);
        return () => clearInterval(interval);
    }, [frames, speed]);
    return (
        <div style={{
            width: size, height: size,
            background: `url(${src}) -${(frame+startFrame)*size}px -${row*size}px no-repeat`,
            imageRendering: 'pixelated',
            borderRadius: 8,
            boxShadow: '0 0 8px #3334',
            margin: '0 auto',
            transform: flipX ? 'scaleX(-1)' : 'none'
        }} />
    );
}

const actions = [
    { label: "Удар в голову", value: "hit_head" },
    { label: "Удар в корпус", value: "hit_body" },
    { label: "Удар в ноги", value: "hit_legs" },
    { label: "Защита головы", value: "block_head" },
    { label: "Защита корпуса", value: "block_body" },
    { label: "Защита ног", value: "block_legs" },
    { label: "Парирование", value: "parry" },
];

const actionSprites = {
    "hit_head":    { row: 2, start: 0, frames: 6 },
    "hit_body":    { row: 2, start: 9, frames: 5 },
    "hit_legs":    { row: 0, start: 9, frames: 7 },
    "block_head":  { row: 3, start: 0, frames: 2 },
    "block_body":  { row: 3, start: 0, frames: 2 },
    "block_legs":  { row: 3, start: 0, frames: 2 },
    "parry":       { row: 4, start: 9, frames: 3 },
    "idle":        { row: 0, start: 3, frames: 3 },
    "win":         { row: 5, start: 0, frames: 4 },
    "lose":        { row: 3, start: 3, frames: 5 }
};

const initialPlayer = {
    hp: 100,
    energy: 5,
    initiative: 3,
    action: "",
};

function Progress({ value }) {
    return (
        <div style={{
            background: '#eee', borderRadius: 6, overflow: 'hidden',
            height: 14, margin: '4px 0'
        }}>
            <div style={{
                width: value + '%', background: '#0cf', height: 14
            }} />
        </div>
    );
}

export default function App() {
    const [playerA, setPlayerA] = useState({ ...initialPlayer });
    const [playerB, setPlayerB] = useState({ ...initialPlayer });
    const [log, setLog] = useState([]);

    function resolveTurn() {
        const newLog = [];

        // Сначала вычисляем результаты атак
        const resultA = executeAction(playerA, playerB, "Игрок A");
        const resultB = executeAction(playerB, playerA, "Игрок B");

        // HP уменьшается от урона противника
        const nextPlayerA = {
            ...resultA.self,
            hp: Math.max(0, playerA.hp - resultB.dealtDamage),
        };
        const nextPlayerB = {
            ...resultB.self,
            hp: Math.max(0, playerB.hp - resultA.dealtDamage),
        };

        setPlayerA(nextPlayerA);
        setPlayerB(nextPlayerB);

        newLog.push(`Игрок A выбрал ${actionLabel(playerA.action)}, Игрок B выбрал ${actionLabel(playerB.action)}`);
        newLog.push(resultA.log);
        newLog.push(resultB.log);
        newLog.push("-----");

        setLog([...newLog, ...log]);
    }

    function executeAction(self, enemy, selfName = "") {
        let log = "";
        let damage = 0;
        let initiativeChange = 0;
        let dealtDamage = 0;
        let energyChange = 0;

        const selfAction = self.action;
        const enemyAction = enemy.action;

        const canParry = selfAction === "parry" && self.initiative >= 3;

        // 1. УДАР
        if (selfAction && selfAction.startsWith("hit_")) {
            initiativeChange = -1;
            energyChange = -1;

            // Противник блокирует этот удар или парирует?
            const enemyBlocks = enemyAction === "block_" + selfAction.slice(4);
            const enemyParries = enemyAction === "parry" && enemy.initiative >= 3;

            damage = 10 + Math.min(self.energy, 5);
            if (self.energy >= 7) {
                damage += 2;
            }
            if (self.energy <= 3) {
                damage -= 2;
            }

            if (enemyBlocks) {
                damage -= 7;
                energyChange = -1; // Тратится энергия
                log = `${selfName}: Атака в ${actionLabel(selfAction)} блокирована. Урон: ${Math.max(0, damage)}`;
            } else if (enemyParries) {
                damage = 0;
                energyChange = -1; // Тратится энергия
                log = `${selfName}: Парирование! Атака в ${actionLabel(selfAction)} отражена, получил 1 урон.`;
            } else {
                energyChange = 0; // Успешная атака — энергия не тратится
                log = `${selfName}: Успешная атака в ${actionLabel(selfAction)}. Урон: ${damage}`;
            }
        }

        // 2. БЛОК
        else if (selfAction && selfAction.startsWith("block_")) {
            initiativeChange = +1;
            // Был ли удар именно в этот сектор?
            const attacked = enemy.action && enemy.action === "hit_" + selfAction.slice(6);
            if (attacked) {
                energyChange = +2;
                log = `${selfName}: Успешно защитился (${actionLabel(selfAction)}). +2 энергии`;
            } else {
                energyChange = +1;
                log = `${selfName}: Защита (${actionLabel(selfAction)}). +1 энергия`;
            }
        }

        // 3. ПАРИРОВАНИЕ
        else if (selfAction === "parry") {
            initiativeChange = -3;
            energyChange = -1;
            if (canParry && enemy.action && enemy.action.startsWith("hit_")) {
                log = `${selfName}: Парирование! Контратака — противник получает 1 урон.`;
                dealtDamage = 1;
            } else if (!canParry) {
                log = `${selfName}: Недостаточно инициативы для парирования!`;
            } else {
                log = `${selfName}: Парирование — но атаки не было.`;
            }
        }

        // 4. ПРОПУСК ХОДА/ОЖИДАНИЕ
        else {
            log = "Ожидание...";
        }

        // Итоговые значения
        const newInitiative = Math.max(0, Math.min(5, self.initiative + initiativeChange));
        const newEnergy = Math.max(0, Math.min(10, self.energy + energyChange));

        if (selfAction && selfAction.startsWith("hit_")) {
            dealtDamage = Math.max(0, damage);
        }

        return {
            self: { ...self, energy: newEnergy, initiative: newInitiative },
            log,
            dealtDamage,
        };
    }

    function StatBar({ value, max, thresholdLow = 3, thresholdHigh = 7, greenCount = 0 }) {
        // greenCount используется для инициативы
        return (
            <span style={{ letterSpacing: 1 }}>
              {[...Array(max)].map((_, i) => {
                  let color = "#bbb"; // по умолчанию — серый
                  if (i < value) {
                      // Для инициативы с зелёными, остальное чёрное
                      if (greenCount > 0 && i < greenCount) color = "#3d7c3d";
                      else if (value <= thresholdLow) color = "#f55"; // розовый если мало
                      else if (value >= thresholdHigh) color = "#059c42"; // зелёный если много
                      else color = "#111"; // чёрный (норма)
                  }
                  return (
                      <span key={i} style={{ color, fontSize: 20, fontWeight: 900 }}>|</span>
                  );
              })}
            </span>
        );
    }

    function actionLabel(value) {
        return actions.find((a) => a.value === value)?.label || value;
    }

    function getSprite(action, hp, hpOpponent) {
        if (hp <= 0) return actionSprites['lose'];
        if (hpOpponent <= 0) return actionSprites['win'];
        if (!action) return actionSprites['idle'];
        return actionSprites[action] || actionSprites['idle'];
    }

    function Modal({ open, onClose, children }) {
        if (!open) return null;
        return (
            <div style={{
                position: 'fixed',
                zIndex: 1000,
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{
                    background: "#fff",
                    borderRadius: 14,
                    maxWidth: 480,
                    minWidth: 320,
                    padding: 32,
                    boxShadow: "0 4px 24px #0002",
                    position: "relative"
                }}>
                    <button onClick={onClose} style={{
                        position: "absolute", top: 10, right: 10, border: "none",
                        background: "none", fontSize: 22, cursor: "pointer", color: "#999"
                    }}>&times;</button>
                    {children}
                </div>
            </div>
        );
    }

    useEffect(() => {
        document.title = "Fight Game";
    }, []);

    const [rulesOpen, setRulesOpen] = useState(false);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <button onClick={() => setRulesOpen(true)}
                        style={{
                            background: "#059c42",
                            color: "#fff",
                            border: "none",
                            borderRadius: 7,
                            padding: "8px 20px",
                            fontSize: 16,
                            cursor: "pointer",
                            fontWeight: 600,
                            boxShadow: "0 1px 6px #059c4222"
                        }}>
                    Правила игры
                </button>
            </div>

            <Modal open={rulesOpen} onClose={() => setRulesOpen(false)}>
                <h2 style={{ marginTop: 0, fontSize: 24, color: "#000" }}>Правила боя</h2>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: "#000" }}>
                    Каждый раунд оба игрока выбирают действие: удар, блок или парирование.
                </div>
                <ul style={{ fontSize: 15, lineHeight: 1.55, paddingLeft: 20, color: "#000" }}>
                    <li><b>Удар</b>: базовый урон 10 + энергия (макс. +5), если энергия ≥7 — +2 урона, если ≤3 — -2 урона. При любом ударе тратится 1 энергия.</li>
                    <li><b>Блок</b>: если блок совпал с атакой — +2 энергии, иначе +1.</li>
                    <li><b>Парирование</b>: тратит 3 инициативы и 1 энергию, возможно только при инициативе ≥3; отражает удар и наносит 1 урон атакующему.</li>
                    <li>Инициатива расходуется: удар -1, парирование -3, блок +1.</li>
                </ul>

                <div style={{ margin: "18px 0 0 0", fontSize: 16, fontWeight: 600, color: "#000" }}>Энергия:</div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: "#000" }}>
                    • Влияет на силу удара: чем больше энергии — тем мощнее атака.<br />
                    • Энергия тратится при ударе и парировании, накапливается при защите.<br />
                    • Если энергии мало (≤3) — урон от твоих атак снижается.<br />
                    • Если энергии много (≥7) — урон увеличивается.<br />
                    • Максимум — 10.
                </div>

                <div style={{ margin: "18px 0 0 0", fontSize: 16, fontWeight: 600, color: "#000" }}>Инициатива:</div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: "#000" }}>
                    • Определяет, можно ли использовать парирование.<br />
                    • После удара инициатива уменьшается, после блока — увеличивается.<br />
                    • Если инициатива ≥3, ты можешь парировать атаку соперника.<br />
                    • Максимум — 5.
                </div>

                <div style={{ fontSize: 13, color: "#666", marginTop: 16 }}>
                    <b>Цель:</b> Победи противника, первым снизив его HP до 0!
                </div>
            </Modal>

            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24
            }}>
                {[playerA, playerB].map((player, idx) => {
                    const hpOpponent = idx === 0 ? playerB.hp : playerA.hp;
                    const sprite = getSprite(player.action, player.hp, hpOpponent);
                    return (
                        <div key={idx} style={{
                            border: '1px solid #999', borderRadius: 10, padding: 16,
                            background: '#fff', boxShadow: '0 2px 16px #0001'
                        }}>
                            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "#000" }}>
                                Игрок {idx === 0 ? "A" : "B"}
                            </h2>
                            <SpriteAnimator
                                src={`${import.meta.env.BASE_URL}Char_3_No_Armor.png`}
                                row={sprite.row}
                                startFrame={sprite.start}
                                frames={sprite.frames}
                                size={64}
                                flipX={idx === 1}
                            />
                            <div style={{ width: '100%', color: "#000" }}>HP: <Progress value={player.hp} /></div>
                            <div style={{ width: '100%', color: "#000" }}>
                                Энергия: <StatBar value={player.energy} max={10} />
                            </div>
                            <div style={{ width: '100%', color: "#000" }}>
                                Инициатива: <StatBar value={player.initiative} max={5} greenCount={player.initiative} />
                            </div>
                            <select
                                value={player.action}
                                onChange={e => {
                                    idx === 0
                                        ? setPlayerA(p => ({ ...p, action: e.target.value }))
                                        : setPlayerB(p => ({ ...p, action: e.target.value }));
                                }}
                                style={{ width: '100%', marginTop: 12, padding: 8, borderRadius: 6 }}
                            >
                                <option value="">Выбери действие</option>
                                {actions.map(a =>
                                    <option key={a.value} value={a.value}>{a.label}</option>
                                )}
                            </select>
                        </div>
                    );
                })}
                <div style={{ gridColumn: '1/3', display: 'flex', justifyContent: 'center', margin: 16 }}>
                    <button
                        onClick={resolveTurn}
                        style={{ padding: '10px 36px', fontWeight: 700, borderRadius: 8, background: '#0cf', color: '#fff', border: 'none' }}
                    >
                        Ход
                    </button>
                </div>
                <div style={{ gridColumn: '1/3', marginTop: 12 }}>
                    {log.slice(0, 10).map((line, i) => (
                        <div key={i} style={{ fontSize: 14, marginBottom: 3 }}>{line}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
