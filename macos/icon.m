#import <Cocoa/Cocoa.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 2) { return 1; }
        const CGFloat size = 1024;
        NSImage *image = [[NSImage alloc] initWithSize:NSMakeSize(size, size)];
        [image lockFocus];

        NSRect bounds = NSMakeRect(0, 0, size, size);
        NSGradient *background = [[NSGradient alloc]
            initWithStartingColor:[NSColor colorWithSRGBRed:0.18 green:0.34 blue:0.70 alpha:1]
              endingColor:[NSColor colorWithSRGBRed:0.10 green:0.20 blue:0.46 alpha:1]];
        NSBezierPath *outer = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(bounds, 62, 62)
                                                              xRadius:205
                                                              yRadius:205];
        [background drawInBezierPath:outer angle:-75];

        NSColor *surface = [NSColor colorWithWhite:1 alpha:0.94];
        [surface setFill];
        NSBezierPath *board = [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(190, 220, 644, 584)
                                                              xRadius:58
                                                              yRadius:58];
        [board fill];

        NSArray<NSColor *> *colors = @[
            [NSColor colorWithSRGBRed:0.39 green:0.46 blue:0.56 alpha:1],
            [NSColor colorWithSRGBRed:0.23 green:0.51 blue:0.93 alpha:1],
            [NSColor colorWithSRGBRed:0.13 green:0.77 blue:0.37 alpha:1]
        ];
        NSArray<NSNumber *> *heights = @[@360, @460, @300];
        for (NSInteger index = 0; index < 3; index++) {
            CGFloat x = 242 + index * 181;
            CGFloat height = heights[index].doubleValue;
            [colors[index] setFill];
            NSBezierPath *column = [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(x, 280, 128, height)
                                                                   xRadius:30
                                                                   yRadius:30];
            [column fill];

            [[NSColor colorWithWhite:1 alpha:0.82] setFill];
            for (NSInteger cardIndex = 0; cardIndex < 2; cardIndex++) {
                CGFloat cardY = 320 + cardIndex * 105;
                if (cardY + 70 < 280 + height) {
                    [[NSBezierPath bezierPathWithRoundedRect:NSMakeRect(x + 20, cardY, 88, 68)
                                                     xRadius:15
                                                     yRadius:15] fill];
                }
            }
        }

        [image unlockFocus];
        CGImageRef cgImage = [image CGImageForProposedRect:NULL context:nil hints:nil];
        NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:cgImage];
        NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        NSString *path = [NSString stringWithUTF8String:argv[1]];
        return [png writeToFile:path atomically:YES] ? 0 : 2;
    }
}
