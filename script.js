
"use strict";

const STORAGE_KEY = "spendwise-transactions-v1";
const BUDGET_KEY = "spendwise-monthly-budgets-v1";

const $ = (id) => document.getElementById(id);

const form = $("transactionForm");
const typeInput = $("type");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const descriptionInput = $("description");
const searchInput = $("search");
const filterInput = $("filter");
const budgetForm = $("budgetForm");
const budgetMonthInput = $("budgetMonth");
const budgetAmountInput = $("budgetAmount");

const VALID_TYPES = ["income", "expense"];
const VALID_CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Education",
  "Health", "Salary", "Freelance", "Other"
];

let transactions = loadTransactions();
let budgets = loadBudgets();
let editingId = null;

function localDateString(date = new Date()) {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function currentMonth() {
  return localDateString().slice(0, 7);
}

function createId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(data)) return [];

    return data.filter((item) =>
      item &&
      typeof item.id === "string" &&
      VALID_TYPES.includes(item.type) &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      item.amount <= 1000000000 &&
      typeof item.description === "string" &&
      item.description.trim().length > 0 &&
      VALID_CATEGORIES.includes(item.category) &&
      typeof item.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    );
  } catch {
    return [];
  }
}

function loadBudgets() {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    const data = raw ? JSON.parse(raw) : {};

    if (!data || Array.isArray(data) || typeof data !== "object") {
      return {};
    }

    const clean = {};

    for (const [month, amount] of Object.entries(data)) {
      if (
        /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
        Number.isFinite(amount) &&
        amount > 0 &&
        amount <= 1000000000
      ) {
        clean[month] = amount;
      }
    }

    return clean;
  } catch {
    return {};
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    $("formMessage").textContent =
      "Unable to save transactions. Check your browser storage.";
    return false;
  }
}

function saveBudgets() {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
    return true;
  } catch {
    $("budgetMessage").textContent =
      "Unable to save the budget. Check your browser storage.";
    return false;
  }
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-IN", {
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

function renderBudget() {
  const month = budgetMonthInput.value || currentMonth();
  const limit = budgets[month];

  const spent = transactions
    .filter((item) =>
      item.type === "expense" && item.date.startsWith(month)
    )
    .reduce((sum, item) => sum + item.amount, 0);

  const remaining = limit === undefined ? null : limit - spent;
  const percentage = limit ? (spent / limit) * 100 : 0;

  $("budgetSpent").textContent = money(spent);
  $("budgetRemaining").textContent =
    remaining === null ? "—" : money(remaining);

  $("remainingLabel").textContent =
    remaining !== null && remaining < 0
      ? "Amount over budget"
      : "Budget remaining";

  $("budgetLimitLabel").textContent =
    limit === undefined ? "Limit: not set" : `Limit: ${money(limit)}`;

  const fill = $("budgetProgressFill");
  const progress = $("budgetProgress");

  fill.classList.remove("warning", "over-budget");

  if (limit === undefined) {
    $("budgetPercent").textContent = "Set a budget to get started";
    $("budgetTip").textContent =
      "Tip: Choose a month and enter a spending limit to start tracking.";
    fill.style.width = "0%";
    progress.setAttribute("aria-valuenow", "0");
    progress.setAttribute("aria-valuetext", "No budget set");
    return;
  }

  // Cap the visual bar at 100%, while showing the actual percentage.
  fill.style.width = `${Math.min(percentage, 100)}%`;
  progress.setAttribute("aria-valuenow", String(Math.min(percentage, 100)));
  progress.setAttribute(
    "aria-valuetext",
    `${percentage.toFixed(1)} percent of budget used`
  );

  $("budgetPercent").textContent =
    `${percentage.toFixed(1)}% of budget used`;

  if (percentage >= 100) {
    fill.classList.add("over-budget");
    $("budgetTip").textContent =
      `Budget exceeded by ${money(spent - limit)}. Review your expenses to get back on track.`;
  } else if (percentage >= 80) {
    fill.classList.add("warning");
    $("budgetTip").textContent =
      `You're getting close to your limit. ${money(remaining)} remaining this month.`;
  } else {
    $("budgetTip").textContent =
      `Great progress! You have ${money(remaining)} left in your budget.`;
  }
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
    message.className = "muted small-text";
    message.textContent =
      "Add an expense to see your category-wise spending.";
    container.append(message);
    return;
  }

  const largest = categories[0][1];

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
  renderBudget();
  renderTransactions();
  renderCategories();
}

function resetForm() {
  editingId = null;
  form.reset();
  dateInput.value = localDateString();

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
    !VALID_TYPES.includes(type) ||
    !VALID_CATEGORIES.includes(category) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
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

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const month = budgetMonthInput.value;
  const amount = Number(budgetAmountInput.value);

  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000
  ) {
    $("budgetMessage").textContent =
      "Please select a month and enter a valid budget.";
    return;
  }

  const previous = { ...budgets };
  budgets[month] = amount;

  if (!saveBudgets()) {
    budgets = previous;
    return;
  }

  $("budgetMessage").textContent =
    `Budget saved for ${month}.`;

  // Update the input with the saved limit and refresh the dashboard.
  budgetAmountInput.value = amount;
  renderBudget();
});

budgetMonthInput.addEventListener("change", () => {
  const month = budgetMonthInput.value;

  budgetAmountInput.value =
    month && budgets[month] !== undefined ? budgets[month] : "";

  $("budgetMessage").textContent = "";
  renderBudget();
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

// Initialize the selected month and existing saved budget.
budgetMonthInput.value = currentMonth();
budgetAmountInput.value = budgets[currentMonth()] ?? "";
dateInput.value = localDateString();

render();
