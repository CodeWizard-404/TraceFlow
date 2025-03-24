const { expect } = require('chai');
const sinon = require('sinon');
const QRCode = require('qrcode');
const { ReceiptBook, User, Agent, OTP, ReceiptBookTransfer, ReceiptStub } = require('../../models');
const { transporter } = require('../../config/smtp');
const { sendSMS } = require('../../config/sms');
const ReceiptBookService = require('../../services/receiptBookService');
const OTPService = require('../../services/otpService');

describe('ReceiptBookService', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createReceiptBook', () => {
    it('should create a new receipt book with stub', async () => {
      const qrCodeStub = sandbox.stub(QRCode, 'toDataURL').resolves('fake-qr-code');
      const receiptBookCreateStub = sandbox.stub(ReceiptBook, 'create').resolves({ bookID: 1 });
      const receiptStubCreateStub = sandbox.stub(ReceiptStub, 'create').resolves();
      const logTransferStub = sandbox.stub(ReceiptBookService, 'logTransfer').resolves();

      await ReceiptBookService.createReceiptBook('12345', 'TYPE_A', 1);

      expect(qrCodeStub.calledOnce).to.be.true;
      expect(receiptBookCreateStub.calledOnce).to.be.true;
      expect(receiptStubCreateStub.calledOnce).to.be.true;
      expect(logTransferStub.calledOnce).to.be.true;
    });
  });

  describe('sendToSupplier', () => {
    it('should send multiple books to supplier', async () => {
      const books = [
        { bookID: 1, number: '12345', type: 'TYPE_A', qrCode: 'data:image/png;base64,abc', update: sandbox.stub() },
        { bookID: 2, number: '67890', type: 'TYPE_B', qrCode: 'data:image/png;base64,def', update: sandbox.stub() }
      ];

      sandbox.stub(ReceiptBook, 'findAll').resolves(books);
      sandbox.stub(ReceiptBookService, 'logTransfer').resolves();
      const sendMailStub = sandbox.stub(transporter, 'sendMail').resolves();

      const result = await ReceiptBookService.sendToSupplier([1, 2], 'supplier@test.com', 1);

      expect(result.message).to.equal('2 books sent to supplier');
      expect(sendMailStub.calledOnce).to.be.true;
      books.forEach(book => {
        expect(book.update.calledOnce).to.be.true;
      });
    });
  });

  describe('transfer', () => {
    it('should initiate transfer to user with OTP', async () => {
      // Make sure to properly stub the sendSMS function
      const sendSMSStub = sandbox.stub({ sendSMS }, 'sendSMS').resolves({
        successCount: 1,
        failureCount: 0
      });

      // Rest of your test setup...

      const result = await ReceiptBookService.transfer(/* your test parameters */);

      expect(result.otpID).to.equal(1);
      expect(sendSMSStub.calledOnce).to.be.true;
    });
  });

  describe('validateTransfer', () => {
    it('should validate transfer with correct OTP', async () => {
      const transfers = [{ bookID: 1, fromUserID: 1, update: sandbox.stub() }];
      const book = { update: sandbox.stub() };
      const recipient = { id: 2, email: 'test@test.com' };

      sandbox.stub(ReceiptBookTransfer, 'findAll').resolves(transfers);
      sandbox.stub(OTPService, 'validateOTP').resolves();
      sandbox.stub(User, 'findByPk').resolves(recipient);
      sandbox.stub(ReceiptBook, 'findByPk').resolves(book);
      sandbox.stub(transporter, 'sendMail').resolves();

      const result = await ReceiptBookService.validateTransfer([1], 2, '123456', 'user');

      expect(result.message).to.include('books transferred and validated');
    });
  });

  describe('deleteReceiptBook', () => {
    it('should delete receipt book when conditions are met', async () => {
      const book = {
        bookID: 1,
        number: '12345',
        status: 'In Stock',
        currentHolderID: 1,
        destroy: sandbox.stub().resolves()
      };

      sandbox.stub(ReceiptBookService, 'getReceiptBookById').resolves(book);
      sandbox.stub(ReceiptStub, 'destroy').resolves();
      sandbox.stub(ReceiptBookTransfer, 'destroy').resolves();

      const result = await ReceiptBookService.deleteReceiptBook(1, 1);

      expect(result.message).to.equal('Receipt Book #12345 deleted successfully');
      expect(book.destroy.calledOnce).to.be.true;
    });

    it('should throw error when deleting book with invalid status', async () => {
      const book = {
        status: 'With Supervisor',
        currentHolderID: 1
      };

      sandbox.stub(ReceiptBookService, 'getReceiptBookById').resolves(book);

      try {
        await ReceiptBookService.deleteReceiptBook(1, 1);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('can only be deleted if In Stock');
      }
    });
  });
});
