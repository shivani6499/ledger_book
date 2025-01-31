const express = require("express");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const { Op } = require("sequelize");
const app = express();
const port = 3001;
const cors = require("cors");
app.use(cors());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "views")));
app.get("/trial-balance", (req, res) => {
  res.render("Trial Balance");
});
app.get("/trial-balance", (req, res) => {
  res.render("index");
});

app.get("/ledger-reports", (req, res) => {
  res.render("Ledger-Reports");
});

app.get("/redirect-to-ledger", (req, res) => {
  res.redirect("/ledger-reports");
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "ledger.db"),
});

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

const Ledger = sequelize.define("Ledger", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  book: { type: DataTypes.STRING, allowNull: false },
  pageNo: { type: DataTypes.INTEGER, allowNull: false },
  balance: { type: DataTypes.FLOAT, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
});

const TableEntry = sequelize.define("TableEntry", {
  particulars: { type: DataTypes.STRING, allowNull: true },
  narration1: { type: DataTypes.STRING, allowNull: true },
  debit: { type: DataTypes.FLOAT, allowNull: true },
  particulars2: { type: DataTypes.STRING, allowNull: true },
  narration2: { type: DataTypes.STRING, allowNull: true },
  credit: { type: DataTypes.FLOAT, allowNull: true },
  ledgerId: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = TableEntry;

Ledger.hasMany(TableEntry, { foreignKey: "ledgerId", as: "tableEntries" });
TableEntry.belongsTo(Ledger, { foreignKey: "ledgerId", as: "ledger" });

sequelize
  .sync({ alter: true })
  .then(() => console.log("Database synchronized successfully."))
  .catch((error) => console.error("Database synchronization failed:", error));

app.use(
  session({
    secret: "shivani",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

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
  narration1: { type: DataTypes.STRING, allowNull: true },
  narration2: { type: DataTypes.STRING, allowNull: true },
  particulars2: { type: DataTypes.STRING, allowNull: true },
  transactionType: { type: DataTypes.ENUM("D", "C"), allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  balance: { type: DataTypes.FLOAT, allowNull: false },
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
        attributes: [
          "id",
          "particulars",
          "narration1",
          "debit",
          "particulars2",
          "narration2",
          "credit",
        ],
      },
      attributes: ["book", "pageNo", "date", "balance"],
    });

    if (!ledgerData || ledgerData.length === 0) {
      return res.status(404).json({ message: "No ledger data found." });
    }

    const vouchers = [];

    ledgerData.forEach((ledger) => {
      ledger.tableEntries.forEach((entry) => {
        const {
          debit = 0,
          credit = 0,
          particulars,
          narration1,
          narration2,
          particulars2,
        } = entry;
        const { book, pageNo, date, balance } = ledger;

        const safeParticulars = particulars || "N/A";
        const safeParticulars2 = particulars2 || "N/A";

        if (debit > 0) {
          vouchers.push({
            book,
            pageNo,
            date,
            balance,
            particulars: safeParticulars,
            narration1,
            transactionType: "D",
            amount: debit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });

          vouchers.push({
            book,
            pageNo,
            date,
            balance,
            particulars: "Cash",
            narration1,
            transactionType: "C",
            amount: debit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });
        }

        if (credit > 0) {
          vouchers.push({
            book,
            pageNo,
            date,
            balance,
            particulars: safeParticulars2,
            narration2,
            transactionType: "C",
            amount: credit,
            lastModifiedBy: user.username,
            lastModifiedDate: new Date(),
          });

          vouchers.push({
            book,
            pageNo,
            date,
            balance,
            particulars: "Cash",
            narration2,
            transactionType: "D",
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
    console.error("Error creating vouchers:", error.message);
    res.status(500).json({
      error: "Failed to create vouchers.",
      details: error.message,
    });
  }
});

app.get("/api/voucher/grouped", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message:
          "Please provide both startDate and endDate in the query parameters.",
      });
    }

    const vouchers = await Voucher.findAll({
      attributes: [
        "particulars",
        "transactionType",
        "narration1",
        "narration2",
        [sequelize.literal("COALESCE(SUM(amount), 0)"), "totalAmount"],
      ],
      where: {
        date: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      group: ["particulars", "transactionType", "narration1", "narration2"],
      raw: true,
    });

    if (!vouchers || vouchers.length === 0) {
      return res.status(404).json({
        message: "No vouchers found for the given date range.",
      });
    }

    const balanceMap = {};
    vouchers.forEach((voucher) => {
      const {
        particulars,
        narration1,
        narration2,
        transactionType,
        totalAmount,
      } = voucher;

      const narration = narration1 || narration2 || "No narration";
      const amount = parseFloat(totalAmount) || 0;

      if (!balanceMap[particulars]) {
        balanceMap[particulars] = { debit: 0, credit: 0, narration };
      }

      if (transactionType === "D") {
        balanceMap[particulars].debit += amount;
      } else if (transactionType === "C") {
        balanceMap[particulars].credit += amount;
      }
    });

    const groupedVouchers = Object.entries(balanceMap).map(
      ([particulars, { debit, credit, narration }]) => ({
        particulars,
        narration,
        debit: parseFloat(debit) || 0,
        credit: parseFloat(credit) || 0,
        balance: parseFloat(debit - credit) || 0,
      })
    );

    res.status(200).json({ groupedVouchers });
  } catch (error) {
    console.error("Error fetching grouped vouchers:", error);
    res.status(500).json({ error: "Failed to fetch grouped vouchers." });
  }
});

app.get("/api/ledger-reports", async (req, res) => {
  try {
    const { startDate, endDate, ledgerName } = req.query;
    console.log(req.query, " req.query");

    if (!startDate || !endDate || !ledgerName) {
      return res.status(400).json({
        message:
          "Please provide startDate, endDate, and ledgerName in the query parameters.",
      });
    }

    const openingBalanceEntry = await Voucher.findOne({
      attributes: ["balance"],
      where: {
        particulars: ledgerName,
        date: { [Op.lte]: new Date(endDate) },
      },
      order: [["date", "DESC"]],
      raw: true,
    });

    console.log("🔍 Opening Balance Query Result:", openingBalanceEntry);

    let openingBalance =
      openingBalanceEntry && openingBalanceEntry.balance !== null
        ? parseFloat(openingBalanceEntry.balance)
        : 0;

    console.log("Calculated Opening Balance:", openingBalance);

    const vouchers = await Voucher.findAll({
      attributes: [
        "particulars",
        "transactionType",
        "narration1",
        "narration2",
        [Sequelize.fn("SUM", Sequelize.col("amount")), "totalAmount"],
      ],
      where: {
        particulars: ledgerName,
        date: { [Op.between]: [new Date(startDate), new Date(endDate)] },
      },
      group: ["particulars", "transactionType", "narration1", "narration2"],
      raw: true,
    });

    console.log("Fetched Vouchers:", vouchers);

    if (!vouchers || vouchers.length === 0) {
      return res.status(404).json({
        message: "No vouchers found for the given date range and ledger.",
      });
    }

    let runningBalance = openingBalance;
    const groupedVouchers = [];

    groupedVouchers.push({
      particulars: ledgerName,
      narration: "Opening Balance",
      debit: 0.0,
      credit: 0.0,
      balance: openingBalance,
    });

    vouchers.forEach((voucher) => {
      const {
        particulars,
        narration1,
        narration2,
        transactionType,
        totalAmount,
      } = voucher;
      const narration = narration1 || narration2 || "No narration";
      const amount = totalAmount ? parseFloat(totalAmount) : 0;

      let debit = 0,
        credit = 0;

      if (transactionType === "D") {
        debit = amount;
        runningBalance += amount;
      } else if (transactionType === "C") {
        credit = amount;
        runningBalance -= amount;
      }

      groupedVouchers.push({
        particulars,
        narration,
        debit,
        credit,
        balance: runningBalance,
      });
    });

    console.log("Final Ledger Report:", groupedVouchers);

    res.status(200).json({ groupedVouchers });
  } catch (error) {
    console.error("Error fetching ledger reports:", error);
    res.status(500).json({ error: "Failed to fetch ledger reports." });
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
      const {
        particulars,
        narration1,
        debit,
        particulars2,
        narration2,
        credit,
      } = entry;

      let existingEntry = await TableEntry.findOne({
        where: {
          ledgerId: ledger.id,
          particulars,
          narration1,
          debit,
          particulars2,
          narration2,
          credit,
        },
      });

      if (!existingEntry) {
        const tableEntry = await TableEntry.create({
          ledgerId: ledger.id,
          particulars: particulars || null,
          narration1: narration1 || null, // Fixed: Added narration1
          debit: debit !== undefined ? debit : null,
          particulars2: particulars2 || null,
          narration2: narration2 || null, // Fixed: Added narration2
          credit: credit !== undefined ? credit : null,
        });

        tableEntryData.push(tableEntry);
      } else {
        existingEntry.particulars = particulars || null;
        existingEntry.narration1 = narration1 || null; // Fixed: Update narration1
        existingEntry.debit = debit !== undefined ? debit : null;
        existingEntry.particulars2 = particulars2 || null;
        existingEntry.narration2 = narration2 || null; // Fixed: Update narration2
        existingEntry.credit = credit !== undefined ? credit : null;
        await existingEntry.save();

        console.log(`Table entry updated for particulars: ${particulars}`);
      }
    }

    res.status(200).json({
      message: "Ledger data saved successfully!",
      ledger,
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
    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "Please provide both fromDate and toDate." });
    }

    console.log("Fetching data from:", fromDate, "to:", toDate);

    const ledgers = await Ledger.findAll({
      where: {
        date: {
          [Op.between]: [fromDate, toDate],
        },
      },
      include: [
        {
          model: TableEntry,
          as: "tableEntries",
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
      return res.status(404).json({
        success: false,
        message: "Entry not found or no changes made",
      });
    }

    res.json({ success: true, message: "Ledger entry updated successfully" });
  } catch (error) {
    console.error("Error updating ledger entry:", error);
    res.status(500).json({
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
          attributes: [
            "debit",
            "credit",
            "narration1",
            "narration2",
            "particulars",
            "particulars2",
          ],
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
          attributes: [
            "id",
            "particulars",
            "narration1",
            "debit",
            "particulars2",
            "narration1",
            "credit",
          ],
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
