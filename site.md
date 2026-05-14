site.md

Auto Placeholder Parts

Create a new web page called "PlaceholderParts.com" with the following
instructions. This will be an e-commerce site where customers can advertise with
at least one picture that the customer will upload to the database. Use
ECMAScript 2025 (ES16), or latest. Use mongodb for the database. Use the most
common and popular UI practices for the site and the style.css. Create a strong
SEO, use autoclaves, sterilizers, medical equipment, medical supplies, medical
parts, hospital supplies, surgery center, surgery center supplies ask me
questions during the build process as needed.

ADMINISTRATION the site needs admin login method for Administrative privileges,
hidden from all customers. Create a database, called Customers. Fields in each
customer document should have all of the typical fields for an e-commerce site,
and include up to 3 fields for customer uploaded pictures, picture1 picture2 and
picture3. Provide readable logging file for administration to follow up on
client form input, purchase's, emails etc. Administration needs to have a way to
send emails to all customer emails in data base

TESTING The administration needs a way to test the site while in development.
such as adding carousel test pictures, links, form input. Probably by using
app.js start dev or start prod or better way.

SECURITY server.js, app.js, html form inputs, database all need the strongest
security

TYPOGRAPHY All pages, background color, #f3f3f3 or rgb(243, 243, 243) font color
#222222 font style Inter, system-ui, sans-serif

DROP DOWNS background color, #f3f3f3 2rem border color rgb(0, 0, 255)

HOME PAGE title: Placeholder Parts the home page should be of grid nature
allowing for each customer to place a picture along with form collected input.
the items in the grid will have customer input the same as "carousel slides"
below but will fit into one of the grid spaces and not rotate. the grid item can
have animation if the client chooses.

FAVICON Make a favicon,

HEADER header background, rgb(0, 0, 255) light colored text color: #e1e6e2; or
rgb(225, 230, 226) the header is at the top of all pages A header with the words
"Placeholder Parts - Search For Parts, Supplies and More!" 3.5rem, #e1e6e2; or
rgb(225, 230, 226) links in header, advertise, login,

LOG IN / CREATE ACCOUNT. Add a log in and "Create Account" function and of
course customer authentication. form entry or valadation error's. If a form
entry fails do not navigate to the home page with a list of error's. If a form
entry caused by the client occurs, do not navigate to a new page, leave the
client on the same (form entry) page and highlight in light red the errors on
the form, perhaps with a gentle prompt above the form stating the highligted
fields need to be properly completed. Use true no-refresh validation (same page
without roundtrip at all), I can add client-side pre-submit validation on top of
this so common input mistakes are caught instantly before request submission.
save time.

I AM NOT A ROBOT
Include a I am not a robot reCAPTCHA with the create Account form

CAROUSEL The carousel is at the top of all pages, under the header A carousel
populates with slides listed below. carousel slides every 5 seconds

CAROUSEL SLIDES Carousel slides are user customizable through html form input.
Create a separate form for creating slide information by customer. customer can
add the following through the html form: customer provided picture file, jpeg,
jpg, png, gif, etc. only 1 allowed picture for the carousel. customer provided
picture can have animation. customer provided link for the customer provided
picture file that fires on picture click, redirecting client to customers
website. No href for any of the slides, links, until customer provides a link as
mentioned above. Company Name. Company website address. Company Phone. Upload
picture, "customer provided picture file, jpeg, jpg, png, gif, etc."

lets add the fucntionality for customer to add a second picture or company
description / statement. Add a new form field

Add ability to add a true separate overlay: new saved description coordinates, a
draggable description box in preview, and independent rendering on live carousel
slides (separate from company/contact caption).

after form is completed route customer to credit card payment page. carousel
will expire on same day of next month if not enrolled in autopay. give customer
the choice of auto renewal or 30 day's only. Inform customer the credit card
will be renewed automatically on the expiration date. credit card payment see
"PAYMENT BY CREDIT CARD", below.

customer uploaded slides do not post on site until administrative approval.
Notify administration by email that a new form has been completed, a fake email
will be noname@nothing.com for now. administration needs the ability to add or
remove to the slides in the carousel. Create automatic slide removal for non
payment or expired payment. remainder of month refunds will not be credited.

populate the page with a carousel at top of page with "Placeholder Parts
Advertise on carousel $100 month." add a non carousel picture "Placeholder Parts
Advertise here $50 month

the administration only has the right to add the carousel to the page after
client completes form and payment method. client has the ability to cancel and
remove slide.

FORM DATA, customer PROVIDED. Customer email. Company Name. Company website
address. Company Phone. Upload picture, "client provided picture file, jpeg,
jpg, png, gif, etc."

CUSTMER EDITS. The customer needs a way to edit their ad if needed, grid or
carousel.

PAYMENT BY CREDIT CARD customer credit card payment system should be
implemented. there is not a credit card payment processing means at this time
while under development.

SIDE BAR Make a way for administration to add list items to the side bar. side
bar has a 2rem #222222 border. The side bar has a small header titled "Search".
the side bar is populated with the following list.

Autoclaves, Disposables Endoscopy Exam Chairs, Tables Head Lamps O.R. Lights
O.R. Tables Property for Sale Sterilizer's, Table Top Vacuum Pumps

The list items do not have any href links now.
