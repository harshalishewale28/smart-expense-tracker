
const STORAGE_KEY = "spendwise-transactions-v1";

const $ = (id) => document.getElementById(id);

const form = $("transactionForm");
const typeInput = $("type");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const descriptionInput = $("description");
const searchInput = $("search");
const filterInput = $("filter");

let transactions = loadTransactions();
let editingId = null;

function today() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) =>
      item &&
      typeof item.id === "string" &&
      ["income", "expense"].includes(item.type) &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      typeof item.description === "string" &&
      typeof item.category === "string" &&
      typeof item.date === "string"
    );
  } catch {
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    $("formMessage").textContent =
      "Could not save data. Check your browser storage.";
    return false;
  }
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function renderSummary() {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  $("balance").textContent = money(income - expenses);
  $("income").textContent = money(income);
  $("expenses").textContent = money(expenses);
}

function makeButton(label, className, action, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", () => action(id));
  return button;
}

function renderTransactions() {
  const list = $("transactionList");
  list.replaceChildren();

  const query = searchInput.value.trim().toLowerCase();
  const filter = filterInput.value;

  const filtered = transactions
    .filter((item) => filter === "all" || item.type === filter)
    .filter((item) =>
      `${item.description} ${item.category} ${item.date}`
        .toLowerCase()
        .includes(query)
    )
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );

  $("transactionCount").textContent =
    `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;

  $("emptyMessage").hidden = filtered.length !== 0;

  filtered.forEach((item) => {
    const row = document.createElement("article");
    row.className = "transaction";

    const info = document.createElement("div");
    info.className = "transaction-info";

    const title = document.createElement("h3");
    title.textContent = item.description;

    const details = document.createElement("p");
    details.textContent = `${item.category} · ${formatDate(item.date)}`;

    info.append(title, details);

    const amount = document.createElement("div");
    amount.className =
      `transaction-amount ${item.type === "income" ? "positive" : "negative"}`;

    amount.textContent =
      `${item.type === "income" ? "+" : "−"}${money(item.amount)}`;

    const actions = document.createElement("div");
    actions.className = "transaction-actions";

    actions.append(
      makeButton("Edit", "small-button", startEdit, item.id),
      makeButton("Delete", "delete-button", deleteTransaction, item.id)
    );

    row.append(info, amount, actions);
    list.append(row);
  });
}

function renderCategories() {
  const container = $("categoryBreakdown");
  container.replaceChildren();

  const totals = {};

  transactions
    .filter((item) => item.type === "expense")
    .forEach((item) => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });

  const categories = Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "Add an expense to see your spending breakdown.";
    container.append(message);
    return;
  }

  const largest = Math.max(...categories.map((entry) => entry[1]));

  categories.forEach(([category, total]) => {
    const item = document.createElement("div");

    const heading = document.createElement("div");
    heading.className = "category-heading";

    const name = document.createElement("span");
    name.textContent = category;

    const value = document.createElement("strong");
    value.textContent = money(total);

    heading.append(name, value);

    const track = document.createElement("div");
    track.className = "bar";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(total / largest) * 100}%`;

    track.append(fill);
    item.append(heading, track);
    container.append(item);
  });
}

function render() {
  renderSummary();
  renderTransactions();
  renderCategories();
}

function resetForm() {
  editingId = null;
  form.reset();
  dateInput.value = today();
  $("formTitle").textContent = "Add a transaction";
  $("submitButton").textContent = "Save transaction";
  $("cancelEdit").hidden = true;
  $("formMessage").textContent = "";
}

function startEdit(id) {
  const item = transactions.find((transaction) => transaction.id === id);
  if (!item) return;

  editingId = id;
  typeInput.value = item.type;
  amountInput.value = item.amount;
  categoryInput.value = item.category;
  dateInput.value = item.date;
  descriptionInput.value = item.description;

  $("formTitle").textContent = "Edit transaction";
  $("submitButton").textContent = "Update transaction";
  $("cancelEdit").hidden = false;
  $("formMessage").textContent = "";

  $("formPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function deleteTransaction(id) {
  const item = transactions.find((transaction) => transaction.id === id);
  if (!item) return;

  if (!confirm(`Delete "${item.description}"?`)) return;

  const previous = transactions;
  transactions = transactions.filter((transaction) => transaction.id !== id);

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  if (editingId === id) resetForm();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const description = descriptionInput.value.trim();
  const date = dateInput.value;
  const type = typeInput.value;
  const category = categoryInput.value;

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000 ||
    !description ||
    !date ||
    !["income", "expense"].includes(type)
  ) {
    $("formMessage").textContent =
      "Please enter valid transaction details.";
    return;
  }

  const previous = transactions;

  if (editingId) {
    transactions = transactions.map((item) =>
      item.id === editingId
        ? { ...item, type, amount, category, date, description }
        : item
    );
  } else {
    transactions = [
      ...transactions,
      { id: createId(), type, amount, category, date, description }
    ];
  }

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  const message = editingId
    ? "Transaction updated successfully."
    : "Transaction added successfully.";

  resetForm();
  $("formMessage").textContent = message;
  render();
});

$("cancelEdit").addEventListener("click", resetForm);

$("addTopButton").addEventListener("click", () => {
  $("formPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
  amountInput.focus({ preventScroll: true });
});

searchInput.addEventListener("input", renderTransactions);
filterInput.addEventListener("change", renderTransactions);

dateInput.value = today();
render();
