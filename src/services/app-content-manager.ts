import { Constants } from "../constants";
import { FilePayload } from "../models/file-payload";

export class AppContentManager {
	public getLoadingAppPayloads(): FilePayload[] {
		return [
			{
				event: "change",
				file: "package.json",
				fileContents: `{"main":"_loading-page.js"}`
			},
			{
				event: "change",
				file: "_loading-page.js",
				fileContents: this.getLoadingPageContent()
			}
		]
	}

	public getDeprecatedAppPayloads(): FilePayload[] {
		return [
			{
				event: "change",
				file: "package.json",
				fileContents: `{"main":"_deprecated-error.js"}`
			},
			{
				event: "change",
				file: "_deprecated-error.js",
				fileContents: this.getDeprecatedPageContent()
			}
		];
	}

	private getDeprecatedPageContent(): string {
		return `var application = require("tns-core-modules/application"),
			Page = require("tns-core-modules/ui/page").Page,
			ActionBar = require("tns-core-modules/ui/action-bar").ActionBar,
			Label = require("tns-core-modules/ui/label").Label,
			Image = require("tns-core-modules/ui/image").Image,
			Button = require("tns-core-modules/ui/button").Button,
			StackLayout = require("tns-core-modules/ui/layouts/stack-layout").StackLayout,
			FlexboxLayout = require("tns-core-modules/ui/layouts/flexbox-layout").FlexboxLayout,
			utils = require("tns-core-modules/utils/utils");
		application.start({
			create: () => {
				let page = new Page();
				page.css = ".main-container { background-color: #0c2834; flex-direction: column; color: #fff; align-items: center; justify-content: center; } .header { padding-top: 50%; font-size: 24; } .labelContainer { padding: 20% 50% 60% 50%; } .label { color: #a0b4bd; text-align: center; } .button { background-color: #4456fe; width: 70%; height: 120px; }";
				let actionBar = new ActionBar();
				actionBar.title = "Update";
				actionBar.color = "#fff";
				actionBar.backgroundColor = "#0c2834";
				page.actionBar = actionBar;
				let layout = new FlexboxLayout();
				layout.cssClasses.add("main-container");
				let image = new Image();
				image.src = "data:image/png;base64,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";
				image.width = "20%";
				let header = new Label();
				header.textWrap = true;
				header.text = "App update is required";
				header.cssClasses.add("header");
				let labelContainer = new StackLayout();
				labelContainer.cssClasses.add("labelContainer");
				let label = new Label();
				label.textWrap = true;
				label.text = "Update to the latest version and scan the QR code again.";
				label.cssClasses.add("label");
				labelContainer.addChild(label);
				let button = new Button();
				button.text = "Update";
				button.cssClasses.add("button");
				button.on(Button.tapEvent, args => {
					if (application.android) {
						var context = utils.ad.getApplicationContext();
						var Intent = android.content.Intent;
						var intent = new Intent(Intent.ACTION_VIEW);
						intent.setData(android.net.Uri.parse("https://play.google.com/store/apps/details?id=${Constants.PreviewGooglePlayId}"));
						intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
						context.startActivity(intent);
					} else if (application.ios) {
						var sharedApplication = utils.ios.getter(UIApplication, UIApplication.sharedApplication);
						var storeUrl = NSURL.URLWithString("itms-apps://itunes.apple.com/app/id${Constants.PreviewAppStoreId}");
						if (sharedApplication.canOpenURL(storeUrl)) {
							sharedApplication.openURL(storeUrl);
						} else {
							storeUrl = NSURL.URLWithString("https://itunes.apple.com/app/id${Constants.PreviewAppStoreId}");
							sharedApplication.openURL(storeUrl);
						}
					}
				});
				layout.addChild(image);
				layout.addChild(header);
				layout.addChild(labelContainer);
				layout.addChild(button);
				page.content = layout;
				return page;
			}
		});`;
	}

	private getLoadingPageContent(): string {
		return `var application = require("tns-core-modules/application"),
		Page = require("tns-core-modules/ui/page").Page,
		ActionBar = require("tns-core-modules/ui/action-bar").ActionBar,
		ActivityIndicator = require("tns-core-modules/ui/activity-indicator").ActivityIndicator,
		Label = require("tns-core-modules/ui/label").Label,
		Image = require("tns-core-modules/ui/image").Image,
		Button = require("tns-core-modules/ui/button").Button,
		StackLayout = require("tns-core-modules/ui/layouts/stack-layout").StackLayout,
		FlexboxLayout = require("tns-core-modules/ui/layouts/flexbox-layout").FlexboxLayout,
		utils = require("tns-core-modules/utils/utils");
	
		application.start({
			create: () => {
				let page = new Page();
				page.css = ".main-container { background-color: #0c2834; flex-direction: column; color: #fff; align-items: center; justify-content: center; } .header { padding-top: 50%; font-size: 24; } .labelContainer { padding: 20% 50% 60% 50%; } .label { color: #a0b4bd; text-align: center; } .button { background-color: #4456fe; width: 70%; height: 120px; }";
	
				let layout = new FlexboxLayout();
				layout.cssClasses.add("main-container");
	
				let actionBar = new ActionBar();
				actionBar.title = "";
				actionBar.color = "#fff";
				actionBar.backgroundColor = "#0c2834";
				page.actionBar = actionBar;
	
				let image = new Image();
				image.src = "data:image/png;base64,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";
				image.width = "20%";
	
				let header = new Label();
				header.textWrap = true;
				header.text = "Loading your project";
				header.cssClasses.add("header");
	
				let labelContainer = new StackLayout();
				labelContainer.cssClasses.add("labelContainer");
				let label = new Label();
				label.textWrap = true;
				label.text = "This may take a while...";
				label.cssClasses.add("label");
				// Uncomment this line for v2 of loading page.
				// labelContainer.addChild(label);
	
				let activityIndicator = new ActivityIndicator();
				activityIndicator.busy = true;
	
				layout.addChild(image);
				layout.addChild(header);
				layout.addChild(labelContainer);
				layout.addChild(activityIndicator);
	
				page.content = layout;
	
				return page;
			}
		});`;
	}
 }