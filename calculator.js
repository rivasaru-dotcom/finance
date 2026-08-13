
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const $ = id => document.getElementById(id);

    const money = value => {
        const amount = Number(value) || 0;

        return new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
            maximumFractionDigits: 0
        }).format(Math.max(0, amount));
    };

    const number = value => {
        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? Math.max(0, parsed)
            : 0;
    };

    const set = (id, value) => {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    };

    const get = id => {
        const element = $(id);

        return element
            ? number(element.value)
            : 0;
    };

    const getValue = id => {
        const element = $(id);

        return element
            ? element.value
            : "";
    };


    /* =========================================================
       2. FORMATTING HELPERS
       ========================================================= */

    function formatMonths(months) {
        const total = Math.max(0, Math.round(months));

        const years = Math.floor(total / 12);
        const remainingMonths = total % 12;

        if (years === 0) {
            return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
        }

        if (remainingMonths === 0) {
            return `${years} year${years === 1 ? "" : "s"}`;
        }

        return `${years}y ${remainingMonths}m`;
    }


    function formatPercentage(value, decimals = 1) {
        if (!Number.isFinite(value)) {
            return "—";
        }

        return `${value.toFixed(decimals)}%`;
    }


    /* =========================================================
       3. VALIDATION
       ========================================================= */

    function clampLoanTerm(years) {
        return Math.min(
            50,
            Math.max(1, number(years))
        );
    }


    function validateLoan(principal, rate, years) {
        return (
            principal > 0 &&
            rate >= 0 &&
            years > 0
        );
    }


    function showValidation(message) {
        /*
         * Keep validation lightweight for now.
         * We avoid browser alerts so the calculator remains clean.
         */

        console.warn(`Calculator validation: ${message}`);
    }


    /* =========================================================
       4. CORE REPAYMENT MATH
       ========================================================= */

    function calculateMonthlyPayment(
        principal,
        annualRate,
        months
    ) {
        principal = number(principal);
        annualRate = number(annualRate);
        months = Math.max(1, Math.round(months));

        if (principal <= 0) {
            return 0;
        }

        const monthlyRate =
            annualRate / 100 / 12;

        if (monthlyRate === 0) {
            return principal / months;
        }

        const factor =
            Math.pow(
                1 + monthlyRate,
                months
            );

        return (
            principal *
            monthlyRate *
            factor /
            (factor - 1)
        );
    }


    /* =========================================================
       5. AMORTISATION ENGINE
       =========================================================

       This is the central engine used by:
       - P&I
       - Extra repayment
       - Amortisation
       - IO → P&I

       Important:
       - Extra repayments begin after the selected month.
       - Lump sums are applied in the selected month.
       - Lump sums are NOT applied immediately by default.
       ========================================================= */

    function generatePIAmortisation({
        principal,
        annualRate,
        termMonths,
        extraMonthly = 0,
        extraStartMonth = 0,
        lumpSum = 0,
        lumpSumMonth = 0
    }) {

        principal = number(principal);
        annualRate = number(annualRate);

        termMonths =
            Math.max(
                1,
                Math.round(termMonths)
            );

        extraMonthly = number(extraMonthly);
        extraStartMonth =
            Math.max(
                0,
                Math.round(extraStartMonth)
            );

        lumpSum = number(lumpSum);
        lumpSumMonth =
            Math.max(
                0,
                Math.round(lumpSumMonth)
            );

        if (!principal) {
            return {
                rows: [],
                totalInterest: 0,
                totalPaid: 0,
                months: 0,
                basePayment: 0,
                startingBalance: 0
            };
        }

        const monthlyRate =
            annualRate / 100 / 12;

        const basePayment =
            calculateMonthlyPayment(
                principal,
                annualRate,
                termMonths
            );

        let balance = principal;

        let totalInterest = 0;
        let totalPaid = 0;

        const rows = [];

        /*
         * Safety limit.
         *
         * A standard loan should finish inside the original
         * term. The additional buffer protects against rounding
         * or very small payments.
         */
        const maxMonths =
            termMonths + 240;

        for (
            let month = 1;
            month <= maxMonths;
            month++
        ) {

            if (balance <= 0.01) {
                break;
            }

            /*
             * Apply lump sum at the START of the selected month.
             *
             * Example:
             * lumpSumMonth = 60
             *
             * means the lump sum is applied at the beginning
             * of month 60 before interest/payment for month 60.
             */
            let lumpApplied = 0;

            if (
                lumpSum > 0 &&
                lumpSumMonth > 0 &&
                month === lumpSumMonth
            ) {
                lumpApplied =
                    Math.min(
                        balance,
                        lumpSum
                    );

                balance -= lumpApplied;
            }

            /*
             * Monthly interest is calculated after the lump sum.
             */
            const interest =
                balance * monthlyRate;

            /*
             * Extra repayment starts AFTER the chosen delay.
             *
             * extraStartMonth = 0
             * means extras start from month 1.
             *
             * extraStartMonth = 12
             * means extras start from month 13.
             */
            const extra =
                month > extraStartMonth
                    ? extraMonthly
                    : 0;

            let payment =
                basePayment + extra;

            /*
             * If this is the final month, don't overpay.
             */
            let principalPayment =
                payment - interest;

            /*
             * If the normal payment does not cover interest,
             * the loan cannot amortise under these assumptions.
             */
            if (principalPayment <= 0) {
                rows.push({
                    month,
                    type: "P&I",
                    payment: interest,
                    principal: 0,
                    interest,
                    balance,
                    cumInterest: totalInterest,
                    lumpSum: lumpApplied
                });

                totalInterest += interest;
                totalPaid += interest;

                break;
            }

            /*
             * Never pay more principal than remains.
             */
            if (principalPayment > balance) {
                principalPayment = balance;

                payment =
                    principalPayment + interest;
            }

            balance =
                Math.max(
                    0,
                    balance - principalPayment
                );

            totalInterest += interest;
            totalPaid += payment;

            rows.push({
                month,
                type: "P&I",
                payment,
                principal: principalPayment,
                interest,
                balance,
                cumInterest: totalInterest,
                lumpSum: lumpApplied
            });
        }

        return {
            rows,
            totalInterest,
            totalPaid,
            months: rows.length,
            basePayment,
            startingBalance: principal
        };
    }


    /* =========================================================
       6. INTEREST-ONLY ENGINE
       ========================================================= */

    function generateIOToPI({
        principal,
        ioRate,
        piRate,
        totalMonths,
        ioMonths
    }) {

        principal = number(principal);
        ioRate = number(ioRate);
        piRate = number(piRate);

        totalMonths =
            Math.max(
                1,
                Math.round(totalMonths)
            );

        ioMonths =
            Math.max(
                0,
                Math.round(ioMonths)
            );

        /*
         * An IO period cannot consume the entire loan term
         * if there is supposed to be a P&I period afterwards.
         */
        if (ioMonths >= totalMonths) {
            ioMonths =
                Math.max(
                    0,
                    totalMonths - 1
                );
        }

        const remainingMonths =
            Math.max(
                1,
                totalMonths - ioMonths
            );

        const ioMonthlyRate =
            ioRate / 100 / 12;

        const ioPayment =
            principal * ioMonthlyRate;

        const piPayment =
            calculateMonthlyPayment(
                principal,
                piRate,
                remainingMonths
            );

        const ioInterest =
            ioPayment * ioMonths;

        return {
            principal,
            ioMonths,
            remainingMonths,
            ioPayment,
            piPayment,
            ioInterest
        };
    }


    /* =========================================================
       7. COMPLETE IO → P&I SCHEDULE
       ========================================================= */

    function generateIOToPISchedule({
        principal,
        ioRate,
        piRate,
        totalMonths,
        ioMonths,
        extraMonthly = 0,
        extraStartMonth = 0
    }) {

        const plan =
            generateIOToPI({
                principal,
                ioRate,
                piRate,
                totalMonths,
                ioMonths
            });

        const rows = [];

        let cumulativeInterest = 0;

        /*
         * IO period
         */
        for (
            let month = 1;
            month <= plan.ioMonths;
            month++
        ) {

            const interest =
                plan.ioPayment;

            cumulativeInterest += interest;

            rows.push({
                month,
                type: "IO",
                payment: plan.ioPayment,
                principal: 0,
                interest,
                balance: principal,
                cumInterest: cumulativeInterest,
                lumpSum: 0
            });
        }

        /*
         * P&I period
         */
        const piSchedule =
            generatePIAmortisation({
                principal,
                annualRate: piRate,
                termMonths: plan.remainingMonths,
                extraMonthly,
                extraStartMonth:
                    Math.max(
                        0,
                        extraStartMonth - plan.ioMonths
                    )
            });

        piSchedule.rows.forEach(row => {

            cumulativeInterest += row.interest;

            rows.push({
                ...row,
                month:
                    row.month + plan.ioMonths,
                cumInterest:
                    cumulativeInterest
            });
        });

        return {
            ...plan,
            rows,
            totalInterest: cumulativeInterest,
            totalPaid: rows.reduce(
                (sum, row) =>
                    sum + row.payment,
                0
            )
        };
    }


    /* =========================================================
       8. P&I CALCULATOR
       ========================================================= */

    function runPI() {

        const loan = get("piLoan");
        const rate = get("piRate");

        const termYears =
            clampLoanTerm(
                get("piTerm")
            );

        const extra =
            get("piExtra");

        const propertyValue =
            get("piPropertyValue");

        if (!validateLoan(
            loan,
            rate,
            termYears
        )) {
            showValidation(
                "Enter a valid loan amount, interest rate and loan term."
            );

            return;
        }

        const termMonths =
            Math.round(
                termYears * 12
            );

        /*
         * Normal loan
         */
        const normal =
            generatePIAmortisation({
                principal: loan,
                annualRate: rate,
                termMonths
            });

        /*
         * Loan with extra monthly repayment
         */
        const withExtra =
            generatePIAmortisation({
                principal: loan,
                annualRate: rate,
                termMonths,
                extraMonthly: extra,
                extraStartMonth: 0
            });

        const monthlyPayment =
            calculateMonthlyPayment(
                loan,
                rate,
                termMonths
            ) + extra;

        const interestSaved =
            Math.max(
                0,
                normal.totalInterest -
                withExtra.totalInterest
            );

        const monthsSaved =
            Math.max(
                0,
                normal.months -
                withExtra.months
            );

        const total =
            withExtra.totalPaid;

        const interestPercentage =
            total > 0
                ? (
                    withExtra.totalInterest /
                    total
                ) * 100
                : 0;

        set(
            "piMonthly",
            money(monthlyPayment)
        );

        set(
            "piInterest",
            money(
                withExtra.totalInterest
            )
        );

        set(
            "piTotal",
            money(total)
        );

        set(
            "piSaved",
            money(interestSaved)
        );

        set(
            "piTimeSaved",
            formatMonths(monthsSaved)
        );

        set(
            "piInterestPct",
            `${interestPercentage.toFixed(1)}% interest`
        );

        /*
         * LVR
         */
        if (propertyValue > 0) {

            const lvr =
                (loan / propertyValue) * 100;

            set(
                "piLvr",
                formatPercentage(lvr, 1)
            );

        } else {

            set(
                "piLvr",
                "—"
            );
        }

        /*
         * Breakdown bar
         */
        const principalPercentage =
            Math.max(
                0,
                100 - interestPercentage
            );

        const principalBar =
            $("piPrincipalBar");

        const interestBar =
            $("piInterestBar");

        if (principalBar) {
            principalBar.style.width =
                `${principalPercentage}%`;
        }

        if (interestBar) {
            interestBar.style.width =
                `${interestPercentage}%`;
        }
    }


    /* =========================================================
       9. EXTRA REPAYMENT
       ========================================================= */

    function runExtra() {

    const loan =
        get("erLoan");

    const rate =
        get("erRate");

    const termYears =
        clampLoanTerm(
            get("erTerm")
        );

    const extraMonthly =
        get("erExtra");

    const lumpSum =
        get("erLump");

    const extraStartMonth =
        Math.round(
            get("erExtraStart")
        );

    const lumpSumMonth =
        Math.round(
            get("erLumpMonth")
        );

    if (!validateLoan(
        loan,
        rate,
        termYears
    )) {
        showValidation(
            "Enter a valid loan amount, interest rate and loan term."
        );

        return;
    }

    const termMonths =
        Math.round(
            termYears * 12
        );

    /*
     * Normal loan without additional repayments.
     */
    const normal =
        generatePIAmortisation({
            principal: loan,
            annualRate: rate,
            termMonths
        });

    /*
     * Loan with recurring extra repayments
     * and optional lump sum.
     */
    const changed =
        generatePIAmortisation({
            principal: loan,
            annualRate: rate,
            termMonths,
            extraMonthly,
            extraStartMonth,
            lumpSum,
            lumpSumMonth
        });

    const interestSaved =
        Math.max(
            0,
            normal.totalInterest -
            changed.totalInterest
        );

    const monthsSaved =
        Math.max(
            0,
            normal.months -
            changed.months
        );

    set(
        "erSaved",
        money(interestSaved)
    );

    set(
        "erTime",
        formatMonths(monthsSaved)
    );

    set(
        "erNormalInterest",
        money(normal.totalInterest)
    );

    set(
        "erNewInterest",
        money(changed.totalInterest)
    );

    set(
        "erNewTerm",
        formatMonths(changed.months)
    );
}


    /* =========================================================
       10. INTEREST ONLY
       ========================================================= */

    function runIO() {

        const loan =
            get("ioLoan");

        const rate =
            get("ioRate");

        const termYears =
            clampLoanTerm(
                get("ioTerm")
            );

        const ioYears =
            get("ioPeriod");

        const totalMonths =
            Math.round(
                termYears * 12
            );

        const requestedIOMonths =
            Math.round(
                ioYears * 12
            );

        if (
            requestedIOMonths >=
            totalMonths
        ) {

            showValidation(
                "The interest-only period must be shorter than the total loan term."
            );

            return;
        }

        const plan =
            generateIOToPI({
                principal: loan,
                ioRate: rate,
                piRate: rate,
                totalMonths,
                ioMonths:
                    requestedIOMonths
            });

        set(
            "ioPayment",
            money(plan.ioPayment)
        );

        set(
            "ioPi",
            money(plan.piPayment)
        );

        set(
            "ioInterest",
            money(plan.ioInterest)
        );

        set(
            "ioBalance",
            money(plan.principal)
        );

        set(
            "ioRemaining",
            formatMonths(
                plan.remainingMonths
            )
        );
    }
    if (!validateLoan(loan, rate, termYears)) {
    showValidation(
        "Enter a valid loan amount, interest rate and loan term."
    );

    return;
}


    /* =========================================================
       11. IO VS P&I
       ========================================================= */

    function runCompare() {

        const loan =
            get("cmpLoan");

        const piRate =
            get("cmpPiRate");

        const ioRate =
            get("cmpIoRate");

        const termYears =
            clampLoanTerm(
                get("cmpTerm")
            );

        const ioYears =
            get("cmpPeriod");

        const taxRate =
            get("cmpTax") / 100;

        const totalMonths =
            Math.round(
                termYears * 12
            );

        const ioMonths =
            Math.round(
                ioYears * 12
            );

        if (
            ioMonths >= totalMonths
        ) {

            showValidation(
                "The IO period must be shorter than the total loan term."
            );

            return;
        }

        /*
         * P&I scenario
         */
        const piSchedule =
            generatePIAmortisation({
                principal: loan,
                annualRate: piRate,
                termMonths: totalMonths
            });

        /*
         * IO → P&I scenario
         *
         * IMPORTANT:
         * This now uses the correct remaining balance and
         * remaining term rather than amortising a fresh loan
         * incorrectly.
         */
        const ioSchedule =
            generateIOToPISchedule({
                principal: loan,
                ioRate,
                piRate: ioRate,
                totalMonths,
                ioMonths
            });

        const interestDifference =
            ioSchedule.totalInterest -
            piSchedule.totalInterest;

        const afterTaxDifference =
            interestDifference *
            (1 - taxRate);

        set(
            "cmpPiPayment",
            money(
                piSchedule.basePayment
            )
        );

        set(
            "cmpPiInterest",
            money(
                piSchedule.totalInterest
            )
        );

        set(
            "cmpIoPayment",
            money(
                ioSchedule.ioPayment
            )
        );

        set(
            "cmpIoInterest",
            money(
                ioSchedule.totalInterest
            )
        );

        set(
            "cmpAfterTax",
            money(
                Math.max(
                    0,
                    afterTaxDifference
                )
            )
        );
    }


    /* =========================================================
       12. AMORTISATION SCHEDULE
       ========================================================= */

    function runSchedule() {

        const loan =
            get("amLoan");

        const rate =
            get("amRate");

        const termYears =
            clampLoanTerm(
                get("amTerm")
            );

        const type =
            getValue("amType");

        const ioYears =
            get("amIO");

        const extra =
            get("amExtra");

        const totalMonths =
            Math.round(
                termYears * 12
            );

        let result;

        /*
         * P&I schedule
         */
        if (type === "pi") {

            result =
                generatePIAmortisation({
                    principal: loan,
                    annualRate: rate,
                    termMonths: totalMonths,
                    extraMonthly: extra
                });

        /*
         * IO → P&I schedule
         */
        } else {

            const ioMonths =
                Math.round(
                    ioYears * 12
                );

            if (
                ioMonths >= totalMonths
            ) {

                showValidation(
                    "The IO period must be shorter than the total loan term."
                );

                return;
            }

            result =
                generateIOToPISchedule({
                    principal: loan,
                    ioRate: rate,
                    piRate: rate,
                    totalMonths,
                    ioMonths,
                    extraMonthly: extra
                });
        }

        set(
            "amPayment",
            money(
                result.rows[0]?.payment || 0
            )
        );

        set(
            "amInterest",
            money(
                result.totalInterest
            )
        );

        set(
            "amTotal",
            money(
                result.totalPaid
            )
        );

        set(
            "amMonths",
            result.rows.length
        );

        set(
            "amStart",
            money(loan)
        );

        renderSchedule(
            result.rows
        );
    }


    /* =========================================================
       13. SCHEDULE TABLE
       ========================================================= */

    function renderSchedule(rows) {

        const body =
            $("amortisationBody");

        if (!body) {
            return;
        }

        body.innerHTML = "";

        const fragment =
            document.createDocumentFragment();

        rows.forEach(row => {

            const tr =
                document.createElement("tr");

            tr.innerHTML = `
                <td>${row.month}</td>
                <td>${row.type}</td>
                <td>${money(row.payment)}</td>
                <td>${money(row.principal)}</td>
                <td>${money(row.interest)}</td>
                <td>${money(row.balance)}</td>
                <td>${money(row.cumInterest)}</td>
            `;

            fragment.appendChild(tr);
        });

        body.appendChild(fragment);
    }


    /* =========================================================
       14. CALCULATOR ACTION MAP
       ========================================================= */

    const runners = {
        pi: runPI,
        borrowing: () => {},
        stamp: () => {},
        extra: runExtra,
        io: runIO,
        compare: runCompare,
        tax: () => {},
        "land-tax": () => {},
        schedule: runSchedule
    };


    /* =========================================================
       15. CALCULATOR BUTTONS
       ========================================================= */

    document
        .querySelectorAll(".calc-action")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const action =
                        button.dataset.action;

                    runners[action]?.();
                }
            );
        });


    /* =========================================================
       16. CALCULATOR TAB NAVIGATION
       ========================================================= */

    function activateCalculator(
        calculatorKey
    ) {

        document
            .querySelectorAll(".calc-tab")
            .forEach(tab => {

                tab.classList.toggle(
                    "active",
                    tab.dataset.calculator ===
                    calculatorKey
                );
            });

        document
            .querySelectorAll(".calc-panel")
            .forEach(panel => {

                panel.classList.remove(
                    "active"
                );
            });

        const panel =
            $(
                `panel-${calculatorKey}`
            );

        if (panel) {
            panel.classList.add(
                "active"
            );
        }

        const actionMap = {
            repayment: "pi",
            borrowing: "borrowing",
            stamp: "stamp",
            extra: "extra",
            "interest-only": "io",
            "io-vs-pi": "compare",
            tax: "tax",
            "land-tax": "land-tax",
            schedule: "schedule"
        };

        const action =
            actionMap[calculatorKey];

        if (action) {
            runners[action]?.();
        }

        if (
            calculatorKey ===
            "schedule"
        ) {

            setTimeout(() => {

                panel?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }, 50);
        }
    }


    document
        .querySelectorAll(".calc-tab")
        .forEach(tab => {

            tab.addEventListener(
                "click",
                () => {

                    activateCalculator(
                        tab.dataset.calculator
                    );
                }
            );
        });


    /* =========================================================
       17. CATEGORY NAVIGATION
       ========================================================= */

    document
        .querySelectorAll(".calculator-category")
        .forEach(category => {

            category.addEventListener(
                "click",
                () => {

                    const selectedCategory =
                        category.dataset.category;

                    /*
                     * Activate category
                     */
                    document
                        .querySelectorAll(
                            ".calculator-category"
                        )
                        .forEach(button => {

                            button.classList.toggle(
                                "active",
                                button === category
                            );
                        });

                    /*
                     * Show category's calculator group
                     */
                    document
                        .querySelectorAll(
                            ".calculator-group"
                        )
                        .forEach(group => {

                            group.classList.toggle(
                                "active",
                                group.dataset.group ===
                                selectedCategory
                            );
                        });

                    /*
                     * Automatically select first
                     * calculator in that category.
                     */
                    const group =
                        document.querySelector(
                            `.calculator-group[data-group="${selectedCategory}"]`
                        );

                    const firstTab =
                        group?.querySelector(
                            ".calc-tab"
                        );

                    if (!firstTab) {
                        return;
                    }

                    activateCalculator(
                        firstTab.dataset.calculator
                    );
                }
            );
        });


    /* =========================================================
       18. AMORTISATION TABLE TOGGLE
       ========================================================= */

    $("toggleSchedule")?.addEventListener(
        "click",
        () => {

            const wrapper =
                $("scheduleTableWrapper");

            if (!wrapper) {
                return;
            }

            const visible =
                wrapper.classList.toggle(
                    "visible"
                );

            $("toggleSchedule").textContent =
                visible
                    ? "Hide schedule"
                    : "Show schedule";
        }
    );

    $("sdState")?.addEventListener(
        "change",
        () => {
            runners.stamp?.();
        }
    );

    $("ltState")?.addEventListener(
        "change",
        () => {
            runners["land-tax"]?.();
        }
    );
    const scrollTop =
        $("scrollTop");

    window.addEventListener(
        "scroll",
        () => {

            scrollTop?.classList.toggle(
                "visible",
                window.scrollY > 500
            );
        }
    );


    scrollTop?.addEventListener(
        "click",
        () => {

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );
    if ($("footerYear")) {

        $("footerYear").textContent =
            new Date().getFullYear();
    }
    runPI();

});