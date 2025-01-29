const express = require("express");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const { Op } = require("sequelize");

const app = express();
const port = 3001;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "views")));
app.get("/trial-balance", (req, res) => {
  res.render("Trial Balance");
});
app.get("/trial-balance", (req, res) => {
  res.render("index");
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure SQLite database using Sequelize
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "ledger.db"),
});

// Models
const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

// const Voucher = sequelize.define("Voucher", {
//   id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
//   book: { type: DataTypes.STRING, allowNull: false },
//   pageNo: { type: DataTypes.INTEGER, allowNull: false },
//   date: { type: DataTypes.DATE, allowNull: false },
//   particulars: { type: DataTypes.STRING, allowNull: false },
//   transactionType: { type: DataTypes.ENUM("D", "C"), allowNull: false }, // Debit or Credit
//   amount: { type: DataTypes.FLOAT, allowNull: false },
//   balance: { type: DataTypes.FLOAT, allowNull: false },
//   lastModifiedBy: { type: DataTypes.STRING, allowNull: false },
//   lastModifiedDate: { type: DataTypes.DATE, allowNull: false },
// });

const Ledger = sequelize.define("Ledger", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  book: { type: DataTypes.STRING, allowNull: false },
  pageNo: { type: DataTypes.INTEGER, allowNull: false },
  balance: { type: DataTypes.FLOAT, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
});

const TableEntry = sequelize.define("TableEntry", {
  particulars: { type: DataTypes.STRING, allowNull: true },
  debit: { type: DataTypes.FLOAT, allowNull: true },
  particulars2: { type: DataTypes.STRING, allowNull: true },
  credit: { type: DataTypes.FLOAT, allowNull: true },
  ledgerId: { type: DataTypes.INTEGER, allowNull: false },
});

// Relationships
Ledger.hasMany(TableEntry, { foreignKey: "ledgerId", as: "tableEntries" });
TableEntry.belongsTo(Ledger, { foreignKey: "ledgerId", as: "ledger" });

// Sync database
sequelize
  .sync({ alter: true })
  .then(() => console.log("Database synchronized successfully."))
  .catch((error) => console.error("Database synchronization failed:", error));

// Configure session middleware
app.use(
  session({
    secret: "shivani", // Use a secure, complex secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Use secure: true with HTTPS
  })
);

// Middleware for authentication
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Routes
app.get("/login", (req, res) => res.render("login"));

app.get("/register", (req, res) => res.render("register"));

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }

  try {
    const user = await User.findOne({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    req.session.userId = user.id;
    res.json({ message: "Login successful.", userId: user.id });
  } catch (error) {
    console.error("Error logging in:", error);
    res
      .status(500)
      .json({ message: "Error logging in.", error: error.message });
  }
});

const Voucher = sequelize.define("Voucher", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  book: { type: DataTypes.STRING, allowNull: false },
  pageNo: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  particulars: { type: DataTypes.STRING, allowNull: false },
  particulars2: { type: DataTypes.STRING, allowNull: true },
  transactionType: { type: DataTypes.ENUM("D", "C"), allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  lastModifiedBy: { type: DataTypes.STRING, allowNull: false },
  lastModifiedDate: { type: DataTypes.DATE, allowNull: false },
});

app.post("/api/voucher", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found or unauthorized." });
    }

    const ledgerData = await Ledger.findAll({
      include: {
        model: TableEntry,
        as: "tableEntries",
        attributes: ["id", "particulars", "debit", "particulars2", "credit"],
      },
    });

    if (!ledgerData || ledgerData.length === 0) {
      return res.status(404).json({ message: "No ledger data found." });
    }

    const vouchers = [];

    ledgerData.forEach((ledger) => {
      ledger.tableEntries.forEach((entry) => {
        const { debit = 0, credit = 0, particulars, particulars2 } = entry;
        const { book, pageNo, date } = ledger;

        // Ensure that "particulars" has a value, fallback to "N/A" if not provided
        const safeParticulars = particulars || "N/A";

        if (debit > 0) {
          // Debit Entry (Exclude particulars2)
          vouchers.push({
            book,
            pageNo,
            date,
            particulars: safeParticulars, // Only safeParticulars here
            transactionType: "D",
            amount: debit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });

          // Duplicate Entry with toggled transactionType and particulars as "Cash"
          vouchers.push({
            book,
            pageNo,
            date,
            particulars: "Cash",
            transactionType: "C", // Toggle transactionType
            amount: debit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });
        }

        if (credit > 0) {
          // Credit Entry (Include particulars2 if necessary)
          vouchers.push({
            book,
            pageNo,
            date,
            particulars: particulars2, // Only safeParticulars here
            transactionType: "C",
            amount: credit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });

          // Duplicate Entry with toggled transactionType and particulars as "Cash"
          vouchers.push({
            book,
            pageNo,
            date,
            particulars: "Cash",
            transactionType: "D", // Toggle transactionType
            amount: credit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });
        }
      });
    });

    const createdVouchers = await Voucher.bulkCreate(vouchers);

    res.status(201).json({
      message: "Vouchers created successfully.",
      vouchers: createdVouchers,
    });
  } catch (error) {
    console.error("Error creating vouchers:", error);
    res.status(500).json({ error: "Failed to create vouchers." });
  }
});

// const { Op } = require("sequelize");

app.get("/api/voucher/grouped", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate date inputs
    if (!startDate || !endDate) {
      return res.status(400).json({
        message:
          "Please provide both startDate and endDate in the query parameters.",
      });
    }

    // Fetch grouped data within the date range
    const vouchers = await Voucher.findAll({
      attributes: [
        "particulars",
        "transactionType",
        [sequelize.fn("SUM", sequelize.col("amount")), "totalAmount"],
      ],
      where: {
        date: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      group: ["particulars", "transactionType"],
      raw: true,
    });

    if (!vouchers || vouchers.length === 0) {
      return res
        .status(404)
        .json({ message: "No vouchers found for the given date range." });
    }

    // Process the data to calculate balances
    const balanceMap = {};
    vouchers.forEach((voucher) => {
      const { particulars, transactionType, totalAmount } = voucher;
      if (!balanceMap[particulars]) {
        balanceMap[particulars] = { debit: 0, credit: 0 };
      }
      if (transactionType === "D") {
        balanceMap[particulars].debit += parseFloat(totalAmount);
      } else if (transactionType === "C") {
        balanceMap[particulars].credit += parseFloat(totalAmount);
      }
    });

    // Prepare the final grouped data with balances
    const groupedVouchers = Object.entries(balanceMap).map(
      ([particulars, { debit, credit }]) => ({
        particulars,
        debit,
        credit,
        balance: debit - credit,
      })
    );

    res.status(200).json({ groupedVouchers });
  } catch (error) {
    console.error("Error fetching grouped vouchers:", error);
    res.status(500).json({ error: "Failed to fetch grouped vouchers." });
  }
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("Error registering user:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      res.status(400).json({ message: "Username already exists." });
    } else {
      res
        .status(500)
        .json({ message: "Error registering user", error: error.message });
    }
  }
});

app.get("/user/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }
    // Render the user-specific page (e.g., index.ejs or dashboard.ejs)
    res.render("index", { user });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).send("Error retrieving user information.");
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Error logging out." });
    }
    res.json({ message: "Logout successful." });
  });
});

app.get("/api/protected", isAuthenticated, (req, res) => {
  res.json({ message: "You have access to this protected route." });
});

sequelize
  .sync({ force: true })
  .then(() => {
    console.log("Database synchronized.");
  })
  .catch((error) => console.error("Error syncing database:", error));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/api/save-ledger", async (req, res) => {
  try {
    const { book, pageNo, balance, date, tableEntries } = req.body;

    console.log("Received Payload:", req.body);

    if (
      !book ||
      !pageNo ||
      !date ||
      !tableEntries ||
      tableEntries.length === 0
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let ledger = await Ledger.findOne({ where: { book, pageNo } });

    if (ledger) {
      ledger.balance = balance;
      ledger.date = date;
      await ledger.save();

      console.log("Ledger updated:", ledger);
    } else {
      ledger = await Ledger.create({ book, pageNo, balance, date });
      console.log("Ledger created:", ledger);
    }

    const tableEntryData = [];

    for (const entry of tableEntries) {
      const { particulars, debit, particulars2, credit } = entry;

      let existingEntry = await TableEntry.findOne({
        where: {
          ledgerId: ledger.id,
          particulars: particulars,
          particulars2: particulars2,
          debit: debit,
          credit: credit,
        },
      });

      if (!existingEntry) {
        const tableEntry = await TableEntry.create({
          ledgerId: ledger.id,
          particulars: particulars || null,
          debit: debit !== undefined ? debit : null,
          particulars2: particulars2 || null,
          credit: credit !== undefined ? credit : null,
        });

        tableEntryData.push(tableEntry);
      } else {
        existingEntry.particulars = particulars || null;
        existingEntry.debit = debit !== undefined ? debit : null;
        existingEntry.particulars2 = particulars2 || null;
        existingEntry.credit = credit !== undefined ? credit : null;
        await existingEntry.save();

        console.log(`Table entry updated for particulars: ${particulars}`);
      }
    }

    res.status(200).json({
      message: "Ledger data saved successfully!",
      ledger: ledger,
      tableEntries: tableEntryData,
    });
  } catch (error) {
    console.error("Error saving ledger data:", error);
    res
      .status(500)
      .json({ message: "Error saving ledger data.", error: error.message });
  }
});
app.get("/api/ledger-data", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Validate the date range
    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "Please provide both fromDate and toDate." });
    }

    console.log("Fetching data from:", fromDate, "to:", toDate);

    // Fetch ledger entries within the date range
    const ledgers = await Ledger.findAll({
      where: {
        date: {
          [Op.between]: [fromDate, toDate],
        },
      },
      include: [
        {
          model: TableEntry, // Assuming TableEntry is associated with Ledger
          as: "tableEntries", // Alias should match the association name in your Sequelize models
        },
      ],
    });

    if (ledgers.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for the specified date range." });
    }

    res.status(200).json({
      message: "Ledger data fetched successfully!",
      data: ledgers,
    });
  } catch (error) {
    console.error("Error fetching ledger data:", error);
    res.status(500).json({
      message: "Error fetching ledger data.",
      error: error.message,
    });
  }
});

app.delete("/api/delete-page/:book/:pageNo", async (req, res) => {
  const { book, pageNo } = req.params;

  try {
    const ledger = await Ledger.findOne({ where: { book, pageNo } });

    if (!ledger) {
      return res
        .status(404)
        .json({ success: false, message: "Ledger page not found." });
    }

    await TableEntry.destroy({ where: { ledgerId: ledger.id } });

    await ledger.destroy();

    res.json({
      success: true,
      message: "Page and its entries deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting page:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting page.",
      error: error.message,
    });
  }
});

app.patch("/api/update-ledger-entry/:id", async (req, res) => {
  const entryId = req.params.id;
  const { field, value } = req.body;

  if (!field || value === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "Field and value are required" });
  }

  try {
    const updatePayload = {};
    updatePayload[field] = value;

    const [updatedRowsCount] = await TableEntry.update(updatePayload, {
      where: { id: entryId },
    });

    if (updatedRowsCount === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Entry not found or no changes made",
        });
    }

    res.json({ success: true, message: "Ledger entry updated successfully" });
  } catch (error) {
    console.error("Error updating ledger entry:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating ledger entry",
        error: error.message,
      });
  }
});

app.get("/api/ledger/:book/:pageNo", async (req, res) => {
  const { book, pageNo } = req.params;

  try {
    const currentPageEntries = await Ledger.findAll({
      where: { book, pageNo },
      include: [
        {
          model: TableEntry,
          as: "tableEntries",
          attributes: ["debit", "credit", "particulars", "particulars2"],
        },
      ],
    });

    let totalDebit = 0;
    let totalCredit = 0;
    let openingBalance = 0;

    if (currentPageEntries.length > 0) {
      currentPageEntries.forEach((ledger) => {
        ledger.tableEntries.forEach((entry) => {
          totalDebit += entry.debit || 0;
          totalCredit += entry.credit || 0;
        });
      });
    }

    if (parseInt(pageNo) > 1) {
      const previousPage = await Ledger.findOne({
        where: { book, pageNo: parseInt(pageNo) - 1 },
        include: [
          {
            model: TableEntry,
            as: "tableEntries",
            attributes: ["debit", "credit"],
          },
        ],
      });

      if (previousPage) {
        let prevTotalDebit = 0;
        let prevTotalCredit = 0;

        previousPage.tableEntries.forEach((entry) => {
          prevTotalDebit += entry.debit || 0;
          prevTotalCredit += entry.credit || 0;
        });

        openingBalance =
          previousPage.balance - prevTotalDebit + prevTotalCredit;
      }
    }

    res.json({
      data: currentPageEntries,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      openingBalance: openingBalance.toFixed(2),
    });
  } catch (error) {
    console.error("Error fetching ledger data:", error);
    res.status(500).json({ error: "Failed to fetch ledger data" });
  }
});

app.get("/api/ledger/all", async (req, res) => {
  try {
    const entries = await Ledger.findAll({
      include: [
        {
          model: TableEntry,
          as: "tableEntries",
          attributes: ["id", "particulars", "debit", "particulars2", "credit"],
        },
      ],
    });

    if (entries.length > 0) {
      let totalDebit = 0;
      let totalCredit = 0;

      entries.forEach((ledger) => {
        ledger.tableEntries.forEach((entry) => {
          totalDebit += entry.debit || 0;
          totalCredit += entry.credit || 0;
        });
      });
      entries.forEach((ledger) => {
        const totalDebitForLedger = ledger.tableEntries.reduce(
          (acc, entry) => acc + (entry.debit || 0),
          0
        );
        const totalCreditForLedger = ledger.tableEntries.reduce(
          (acc, entry) => acc + (entry.credit || 0),
          0
        );
        ledger.openingBalance =
          ledger.balance - totalDebitForLedger + totalCreditForLedger;
      });

      res.json({
        data: entries,
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
      });
    } else {
      res.json({ message: "No ledger entries found" });
    }
  } catch (error) {
    console.error("Error fetching all ledger data:", error);
    res.status(500).json({ error: "Failed to fetch ledger data" });
  }
});

app.patch("/api/delete-ledger-entry-field/:id", async (req, res) => {
  const entryId = req.params.id;
  const { field } = req.body;

  if (!field) {
    return res
      .status(400)
      .json({ success: false, message: "Field name is required." });
  }

  try {
    const updatePayload = {};
    updatePayload[field] = null;

    const [updatedRowsCount] = await TableEntry.update(updatePayload, {
      where: { id: entryId },
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Entry not found or no changes made.",
      });
    }

    res.json({ success: true, message: "Field deleted successfully." });
  } catch (error) {
    console.error("Error deleting field in ledger entry:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting field in ledger entry.",
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
