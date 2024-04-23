/*
	Copy Palette With New Color IDs

	A Toon Boom Harmony shelf script.
	Make a copy of the selected palette in Colour view and then recolor the original colors used in drawings and Colour Selectors with the copied colors.
	The copied colors have unique color IDs (thus independent from the original colors).
	This script is ideal for creating a variant of an existing asset but with different colors.	
	It works on Harmony Premium 15 and up. Please note that this script cannot process colors selected in Colour Override modules.
	
	v1.1 - Added function to recolor Colour Selectors. Conformation Dialog is added.
	v1.11 - "drawing.elementMode" attribute is changed to "drawing.ELEMENT_MODE" to accomodate Harmony 22 update.
	

	Installation:
	
	1) Download and Unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html	
	   
	3) There is a folder named "src" inside the zip file. Copy all its contents directly to the folder above.	
	4) In Harmony, add PAL_Copy_Palette_With_New_Color_IDs function to any toolbar.

	
	Direction:
	
	1) In Colour view, select a palette you want to copy with new IDs.	   
	2) Run PAL_Copy_Palette_With_New_Color_IDs.	
	3) New palette will be created with copied colors. All drawings in the scene will be recolored with the new colors
	4) If you like, remove the original palette from the scene
	
	
	Author:

		Yu Ueda
*/

function PAL_Copy_Palette_With_New_Color_IDs()
{
	var paletteList = PaletteObjectManager.getScenePaletteList();	
	var OGPalID = PaletteManager.getCurrentPaletteId();
	var OGPal = paletteList.getPaletteById(OGPalID);
	
	if (OGPal.nColors == 0)
	{
		MessageBox.information("Selected palette does not have colors to copy.");
		return;		
	}
	else
	{
		var userHitOK = confirmBox(OGPal.getName());
		if (!userHitOK)
			return;
	}
	var CSNodes = getRelativeColorSelectors(OGPal);
	

	scene.beginUndoRedoAccum("Copy Palette With New Color IDs");		
	
	
	var palName = PaletteManager.getCurrentPaletteName();
	
	var newPalName = paletteList.getPath() + "/palette-library/" + palName + "_NewID";	
	var newPalFile = paletteList.createPalette(newPalName, 0);		
	var newPal = paletteList.getPaletteById(newPalFile.id);	
	
	// remove the "Default" color that harmony creates automatically
	var defaultColor = newPal.getColorByIndex(0);
	newPal.removeColor(defaultColor.id);

	var nColorsCaptured = OGPal.nColors;
	for (var c = 0; c < nColorsCaptured; c++)
	{	
		var OGColor = OGPal.getColorByIndex(c);
		var copiedColor = OGPal.duplicateColor(OGColor);	
		newPal.cloneColor(copiedColor);
		OGPal.removeColor(copiedColor.id);		
		
		// get drawing nodes that use the original color and then recolor it with the copy
		var drawKeys = getNodeColors(OGColor.id);
		for (var d = 0; d < drawKeys.length; d++)
		{							
			DrawingTools.recolorDrawing(drawKeys[d],[{from: OGColor.id, to: copiedColor.id}]);
		}	

		// get color selectors that use the original color and then recolor it with the copy
		if (CSNodes.length > 0)
			recolorColorSelectorItems(OGColor.id, copiedColor.id, CSNodes);
	}
	
	scene.endUndoRedoAccum();
	

	//--------------------------------------------------Helper Functions-------------------------------------------------->

	
	function confirmBox(palName)
	{
		var dialog = new Dialog();
		dialog.title = "Copy Palette With New Color IDs"; 
		dialog.width = 400;	
		
		var input1 = new TextEdit;
		input1.label = "";
		input1.text = "You are about to make a copy of: \n\n" + palName + "\n\n\nAll colors in the copied palette will have new color IDs.\n\n All drawings and Colour Selector modules that use colors on the original palette will be recolored with colors on the copied palette.";
		dialog.add(input1);
		
		if (!dialog.exec())
			return false;
		else
			return true;			
	}
	

	function getRelativeColorSelectors(_palette)
	{
		var relativeCSNodes = [], colorIdList = [];
		for (var c = 0; c < _palette.nColors; c++)
		{
			var curColor = _palette.getColorByIndex(c);			
			colorIdList.push(curColor.id);
		}	
			
		var _CSNodes = node.getNodes(["TbdColorSelector"]);		
		for (var n in _CSNodes)
		{
			for (var idx = 0; idx < colorIdList.length; idx++)
			{	
				var CSAttr = node.getTextAttr(_CSNodes[n], 1, "selectedcolors");			
				if (CSAttr.indexOf(colorIdList[idx]) !== -1)
				{
					relativeCSNodes.push(_CSNodes[n]);
					break;
				}
			}
		}
		return relativeCSNodes;
	}
	
	
	function recolorColorSelectorItems(OGId, newId, CS)
	{
		for (var n in CS)
		{		
			var CSAttr = node.getTextAttr(CS[n], 1, "selectedcolors");
			var colorArray = JSON.parse(CSAttr);
				
			for (var c in colorArray)
			{
				if (colorArray[c].colorId == OGId)
					colorArray[c].colorId = newId;
			}			
			var newCSAttr = JSON.stringify(colorArray);	
			node.setTextAttr(CS[n], "selectedcolors", 1, newCSAttr);
		}
	}
	
	
	function getNodeColors(colorId)
	{	
		var nodes = node.getNodes(["READ"]);
		
		var drawKey = [];		
		for (var n in nodes)
		{
			var useTiming = node.getAttr(nodes[n], 1, "drawing.ELEMENT_MODE").boolValue();
			var drawColumn = node.linkedColumn(nodes[n], useTiming ? "drawing.element" : "drawing.customName.timing");			
			var frames = getFrames(drawColumn);
			for (var f in frames)
			{
				var drawingColors = DrawingTools.getDrawingUsedColors({node: nodes[n], frame: frames[f]});
				for (var c in drawingColors)
				{
					if (drawingColors[c] == colorId && drawKey.indexOf(drawingColors[c]) == -1)
						drawKey.push({node: nodes[n], frame: frames[f]});
				}
			}
		}
		return drawKey;
	}

	
	function getFrames(drawColumn)
	{
		var checkedCels = [], frameList = [];
		for (var f = 1; f <= frame.numberOf(); f++)
		{
			var curCel = column.getEntry (drawColumn, 1, f);
			if (checkedCels.indexOf(curCel) == -1)
			{
				checkedCels.push(curCel);
				frameList.push(f);
			}
		}
		return frameList;
	}
}