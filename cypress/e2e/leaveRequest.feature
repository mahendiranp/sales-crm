Feature: Leave Request Lifecycle

  Scenario: Employee leave request generates and resolves an AI recommendation

    Given an employee leave form is published with an approval workflow
    When an employee submits a leave request
    Then an approval request should be created

    When the approval remains pending for more than 48 hours
    And the recommendation engine evaluates business rules
    Then an "Approval Overdue" recommendation should be generated

    When the HR user opens the AI Center
    Then the recommendation should be visible under "Open"

    When the HR user selects "Notify Approver"
    Then a notification email should be sent to the approver

    When the manager approves the leave request
    Then the recommendation should be marked as "Resolved"
    And the Business Health score should improve
