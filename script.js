const form = document.getElementById('form');
const facts = document.getElementById('facts');
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString();
const DASH = '–';

const LIMITS = {
  age: [15, 80, 'years'],
  height: [100, 250, 'cm'],
  weight: [30, 300, 'kg'],
};
const ADJUST = 500; // ~0.5 kg per week
const MIN_SAFE = { male: 1500, female: 1200 };

// Mifflin-St Jeor basal metabolic rate (kcal/day)
function bmr({ gender, age, height, weight }) {
  return 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
}
console.assert(bmr({ gender: 'male', age: 30, height: 180, weight: 80 }) === 1780, 'bmr male');
console.assert(bmr({ gender: 'female', age: 30, height: 165, weight: 60 }) === 1320.25, 'bmr female');

function clear(message) {
  facts.classList.add('is-empty');
  ['maintain', 'lose', 'gain', 'bmr'].forEach(id => ($(id).textContent = DASH));
  $('summary').textContent = 'Fill in your age, height and weight to see your numbers.';
  $('note').hidden = true;
  $('error').textContent = message;
}

function update() {
  const data = new FormData(form);
  const v = { gender: data.get('gender'), activity: Number(data.get('activity')) };
  let missing = false;
  let error = '';

  for (const [key, [lo, hi, unit]] of Object.entries(LIMITS)) {
    const input = form.elements[key];
    const raw = input.value.trim();
    v[key] = Number(raw);
    const bad = raw !== '' && !(v[key] >= lo && v[key] <= hi);
    input.setAttribute('aria-invalid', bad);
    if (raw === '') missing = true;
    if (bad && !error) error = `${key[0].toUpperCase() + key.slice(1)} must be between ${lo} and ${hi} ${unit}.`;
  }

  if (missing || error) return clear(error);

  const base = bmr(v);
  const maintain = base * v.activity;
  const floor = MIN_SAFE[v.gender];
  // never suggest more food to lose weight than to maintain it
  const lose = Math.max(maintain - ADJUST, Math.min(floor, maintain));

  $('maintain').textContent = fmt(maintain);
  $('lose').textContent = fmt(lose);
  $('gain').textContent = fmt(maintain + ADJUST);
  $('bmr').textContent = fmt(base);
  $('summary').textContent = `For a ${v.age}-year-old ${v.gender}, ${v.height} cm, ${v.weight} kg`;
  $('error').textContent = '';

  const note = $('note');
  note.hidden = maintain - ADJUST >= floor;
  note.textContent = maintain < floor
    ? `Your maintenance level is already below ${fmt(floor)} calories a day. Talk to a doctor before eating less than this.`
    : `Going below ${fmt(floor)} calories a day isn't recommended without a doctor's guidance, so the weight-loss figure is set to that minimum.`;

  facts.classList.remove('is-empty', 'updated');
  void facts.offsetWidth; // restart the animation
  facts.classList.add('updated');
}

form.addEventListener('input', update);
form.addEventListener('submit', e => e.preventDefault());
update();
