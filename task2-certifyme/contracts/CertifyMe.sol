// SPDX-License-Identifier: MIT
// here imma specify the version as usual
pragma solidity ^0.8.20;

// throughout the code I've used both documentation comments and normal comments, both of them are equally useful
// i've tried not using both together since when there's documentation comments i mean why would we want normal comments lol we're good to understand

/**
 * @title CertifyMe
 * @notice Decentralized Credential Verification System with multi-issuer management,
 *         two-step anti-spam issuance, zero-gas time-decayed expiry, and audit-preserving revocation.
 * @dev Fully self-contained smart contract with custom errors and gas optimizations.
 */
contract CertifyMe {
    // ENUMS & STRUCTS

    // allowing the blockchain to store numbers later instead of strings
    enum CertificateStatus {
        Pending,
        Valid,
        Revoked
    }

    struct Certificate {
        uint256 certificateId; // Pretty straightforward
        address student; // ethereum address of student receiving the certificate
        address issuer; // address of issuer of that certificate
        string workshopId; // workshop/course identifier...
        string title; // title of the certificate...
        uint256 issueDate; // timestamp of when the certificate was issued
        uint256 expiryDate; // Unix timestamp; 0 if nonexpiring
        CertificateStatus status; // Pending, Valid, Revoked
        address revokedBy; // address that revoked the certificate
        string revocationReason; // reason for revocation
        uint256 revocationDate; // timestamp of when the certificate was revoked (which will later go in for formatting)
    }

    // CUSTOM ERRORS

    //some predefined error types that this contract can throw
    error NotOwner();
    error NotIssuer();
    error NotStudent();
    error ZeroAddress();
    error IssuerAlreadyExists();
    error IssuerNotFound();
    error EmptyWorkshopId();
    error EmptyTitle();
    error EmptyReason();
    error CertificateAlreadyExists();
    error CertificateNotFound();
    error CertificateNotPending();
    error CertificateAlreadyRevoked();
    error Unauthorized();

    // EVENTS
    // these are the events that will be used to track the certificates and the issuers

    // allows contract to emit a log when something happens later that can be tracked, for now this is just something
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    // info to be logged when someoen proposes a certificate
    event CertificateProposed(
        uint256 indexed certificateId,
        address indexed student,
        address indexed issuer,
        string workshopId,
        string title,
        uint256 validityDurationInSeconds
    );
    // info to be logged when student acks a certificate
    event CertificateAcknowledged(
        uint256 indexed certificateId,
        address indexed student,
        uint256 issueDate,
        uint256 expiryDate
    );
    // info to be logged when issuer/owner revokes a certificate
    event CertificateRevoked(
        uint256 indexed certificateId,
        address indexed revokedBy,
        string reason,
        uint256 revocationDate
    );

    // STATE VARIABLES

    /// @notice Contract owner / deployer (global arbitrator)
    address public immutable owner;

    /// @notice Tracks authorized active issuers
    mapping(address => bool) public isIssuer;

    /// @dev Internal array of active issuers for enumeration
    address[] private _issuersList;

    /// @dev Maps issuer address to array index in _issuersList
    mapping(address => uint256) private _issuerIndex;

    /// @dev Incremental counter for certificate IDs
    uint256 private _nextCertificateId = 1;

    /// @dev Primary certificate storage by ID
    mapping(uint256 => Certificate) private _certificates;

    /// @dev Tracks validity duration (seconds) requested at proposal time for each certId
    mapping(uint256 => uint256) private _validityDurations;

    /// @dev O(1) duplicate collision tracker: keccak256(student, workshopId) => certificateId
    mapping(bytes32 => uint256) private _certificateByDigest;

    /// @dev Reverse index for student certificate IDs
    mapping(address => uint256[]) private _studentCertificates;

    /// @dev Reverse index for issuer certificate IDs
    mapping(address => uint256[]) private _issuerCertificates;

    // MODIFIERS

    // if person calling this function is not the owner, revert
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // similarly, this checks for authorised issuer
    modifier onlyIssuer() {
        if (!isIssuer[msg.sender]) revert NotIssuer();
        _;
    }

    // CONSTRUCTOR

    // when contract is deployed, this function is called once, and the person who deploys it becomes the owner
    constructor() {
        owner = msg.sender;
    }
    // ACCESS CONTROL & MULTI-ISSUER MANAGEMENT

    /**
     * @notice Grants an address issuer authorization.
     * @param issuer The address to be authorized as an issuer.
     */
    function addIssuer(address issuer) external onlyOwner {
        if (issuer == address(0)) revert ZeroAddress();
        if (isIssuer[issuer]) revert IssuerAlreadyExists();

        isIssuer[issuer] = true;
        _issuerIndex[issuer] = _issuersList.length;
        _issuersList.push(issuer);

        emit IssuerAdded(issuer);
    }

    /**
     * @notice Revokes issuer authorization from an address immediately.
     * @dev Removed issuers instantly lose issuance rights and retroactive revocation capabilities.
     * @param issuer The address to be deauthorized.
     */
    function removeIssuer(address issuer) external onlyOwner {
        if (!isIssuer[issuer]) revert IssuerNotFound();

        isIssuer[issuer] = false;

        uint256 indexToRemove = _issuerIndex[issuer];
        uint256 lastIndex = _issuersList.length - 1;

        if (indexToRemove != lastIndex) {
            address lastIssuer = _issuersList[lastIndex];
            _issuersList[indexToRemove] = lastIssuer;
            _issuerIndex[lastIssuer] = indexToRemove;
        }

        _issuersList.pop();
        delete _issuerIndex[issuer];

        emit IssuerRemoved(issuer);
    }

    /**
     * @notice Returns list of all currently authorized issuers.
     */
    function getAllIssuers() external view returns (address[] memory) {
        return _issuersList;
    }

    // TWO-STEP ANTI-SPAM ISSUANCE

    /**
     * @notice Proposes a new certificate for a student in Pending status.
     * @dev Enforces O(1) duplicate collision check across all issuers.
     * @param student The recipient student address.
     * @param workshopId Unique identifier for the workshop/course.
     * @param title Title or description of the certificate.
     * @param validityDurationInSeconds Duration in seconds for which the certificate remains valid once acknowledged (0 for non-expiring).
     * @return certId The unique certificate ID assigned.
     */
    function proposeCertificate(
        address student,
        string calldata workshopId,
        string calldata title,
        uint256 validityDurationInSeconds
    ) external onlyIssuer returns (uint256 certId) {
        if (student == address(0)) revert ZeroAddress(); // Reject invalid address
        if (bytes(workshopId).length == 0) revert EmptyWorkshopId(); // If lenght of string in bytes is 0, reject
        if (bytes(title).length == 0) revert EmptyTitle(); // Similarly for title

        // to check for duplicates, I'm creating a hash of the student and workshop id
        // if the hash already exists, I reject
        bytes32 digest = keccak256(abi.encodePacked(student, workshopId));
        if (_certificateByDigest[digest] != 0)
            revert CertificateAlreadyExists();

        // store the id in certid, increment the counter for next call
        certId = _nextCertificateId++;

        // and then creating the certificate, storing it the mapping as a struct
        _certificates[certId] = Certificate({
            certificateId: certId,
            student: student,
            issuer: msg.sender,
            workshopId: workshopId,
            title: title,
            issueDate: 0,
            expiryDate: 0,
            status: CertificateStatus.Pending,
            revokedBy: address(0),
            revocationReason: "",
            revocationDate: 0
        });
        _validityDurations[certId] = validityDurationInSeconds; // to remember validity duration
        _certificateByDigest[digest] = certId; // for future duplicate detection
        _studentCertificates[student].push(certId); // push the certid in the student's certificate list
        _issuerCertificates[msg.sender].push(certId); // push the certid in the issuer's certificate list

        emit CertificateProposed(
            certId,
            student,
            msg.sender,
            workshopId,
            title,
            validityDurationInSeconds
        );
    }

    /**
     * @notice Acknowledges a proposed certificate, activating its status to Valid.
     * @dev Only callable by the designated student recipient. Calculates expiryDate dynamically from block.timestamp.
     * @param certId The certificate ID to acknowledge.
     */
    function acknowledgeCertificate(uint256 certId) external {
        Certificate storage cert = _certificates[certId];
        if (cert.certificateId == 0) revert CertificateNotFound();
        if (msg.sender != cert.student) revert NotStudent();
        if (cert.status != CertificateStatus.Pending)
            revert CertificateNotPending();

        cert.status = CertificateStatus.Valid;
        cert.issueDate = block.timestamp;

        uint256 duration = _validityDurations[certId];
        if (duration > 0) {
            cert.expiryDate = block.timestamp + duration;
        } else {
            cert.expiryDate = 0;
        }

        emit CertificateAcknowledged(
            certId,
            msg.sender,
            cert.issueDate,
            cert.expiryDate
        );
    }

    // AUDIT-PRESERVING REVOCATION

    /**
     * @notice Revokes a certificate while permanently retaining full audit trail.
     * @dev Callable by contract owner (global arbitrator) OR original issuer (if currently authorized).
     *      Removed issuers cannot revoke prior certificates.
     * @param certId The certificate ID to revoke.
     * @param reason Mandatory reason explaining why the certificate is being revoked.
     */
    function revokeCertificate(
        uint256 certId,
        string calldata reason
    ) external {
        if (bytes(reason).length == 0) revert EmptyReason();

        Certificate storage cert = _certificates[certId];
        if (cert.certificateId == 0) revert CertificateNotFound();
        if (cert.status == CertificateStatus.Revoked)
            revert CertificateAlreadyRevoked();

        // Authorization rules:
        // 1. Owner can revoke any certificate regardless of issuer status..
        // 2. Original issuer can revoke ONLY if they are still an authorized active issuer....
        bool isAuthorized = (msg.sender == owner) ||
            (msg.sender == cert.issuer && isIssuer[msg.sender]);
        if (!isAuthorized) revert Unauthorized();

        cert.status = CertificateStatus.Revoked;
        cert.revokedBy = msg.sender;
        cert.revocationReason = reason;
        cert.revocationDate = block.timestamp;

        emit CertificateRevoked(certId, msg.sender, reason, block.timestamp);
    }

    // AUTOMATED ZERO-GAS EXPIRY & VERIFICATION

    /**
     * @notice Verifies if a student holds a valid, active certificate for a given workshop.
     * @dev Zero-gas expiry logic: evaluates block.timestamp < expiryDate without modifying storage.
     * @param student The student address.
     * @param workshopId The workshop identifier.
     * @return isValid True strictly if certificate exists, status is Valid, and is not expired.
     * @return certId The matching certificate ID (0 if not found).
     */
    function isValidCertificate(
        address student,
        string calldata workshopId
    ) external view returns (bool isValid, uint256 certId) {
        // create the exact same hash used during certificate generation
        bytes32 digest = keccak256(abi.encodePacked(student, workshopId));
        // lookup the certid using the hash
        certId = _certificateByDigest[digest];

        if (certId == 0) {
            return (false, 0);
        }

        Certificate storage cert = _certificates[certId]; // retreiving the certificate

        if (cert.status != CertificateStatus.Valid) {
            return (false, certId);
        }

        if (cert.expiryDate != 0 && block.timestamp >= cert.expiryDate) {
            return (false, certId);
        }

        return (true, certId);
    }

    // AUDITING & VIEW FUNCTIONS

    /**
     * @notice Retrieves full certificate record by ID.
     * @param certId The certificate ID.
     */
    function getCertificate(
        uint256 certId
    ) external view returns (Certificate memory) {
        // copy certificate from storagge to memory
        Certificate memory cert = _certificates[certId];
        if (cert.certificateId == 0) revert CertificateNotFound();
        return cert;
    }

    /**
     * @notice Returns all certificates (Pending, Valid, Revoked) associated with a student.
     * @param student The student address.
     */
    /**
        In this, I'm gonna get the student's certificate ids, find the length, iterate over the length 
        and copy each and every certificate in the history array that I created earlier, and return the history
    */
    function getStudentHistory(
        address student
    ) external view returns (Certificate[] memory) {
        uint256[] storage ids = _studentCertificates[student];
        uint256 len = ids.length;
        Certificate[] memory history = new Certificate[](len);

        for (uint256 i = 0; i < len; ) {
            history[i] = _certificates[ids[i]];
            unchecked {
                ++i;
            }
        }

        return history;
    }

    /**
     * @notice Returns all certificates issued by a specific issuer address.
     * @param issuer The issuer address.
     */
    /**
        Similarly to the getStudentHistory function, I'm gonna get the issuer's certificate ids, find the length, iterate over the length 
        and copy each and every certificate in the certList array that I created earlier, and return the certList
    */
    function getCertificatesByIssuer(
        address issuer
    ) external view returns (Certificate[] memory) {
        uint256[] storage ids = _issuerCertificates[issuer];
        uint256 len = ids.length;
        Certificate[] memory certList = new Certificate[](len);

        for (uint256 i = 0; i < len; ) {
            certList[i] = _certificates[ids[i]];
            unchecked {
                ++i;
            }
        }

        return certList;
    }
}
